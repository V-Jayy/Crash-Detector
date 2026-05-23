const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const { enrichEventFromMessage } = require("../shared/event-parser");
const { analyzeEvents } = require("../shared/analyzer");
const { groupCrashes } = require("../shared/grouper");
const { detectInstalledGames } = require("../shared/game-detector");
const { crashToPlainText, exportPayload } = require("../shared/formatters");

const rootDir = path.join(__dirname, "..", "..");
const dataDir = path.join(rootDir, "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: "#101317",
    title: "Crash Detector",
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-games", () => readJson("games.json").games);

ipcMain.handle("window-control", (_event, action) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return false;
  if (action === "minimize") win.minimize();
  if (action === "maximize") {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  if (action === "close") win.close();
  return true;
});

ipcMain.handle("detect-games", () => {
  const games = readJson("games.json").games;
  return detectInstalledGames(games);
});

ipcMain.handle("pick-executable", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose an executable to check",
    filters: [{ name: "Executables", extensions: ["exe"] }],
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { filePath, processName: path.basename(filePath) };
});

ipcMain.handle("scan-crashes", async (_event, options = {}) => {
  const games = readJson("games.json").games;
  const signatures = readJson("crash-signatures.json");
  const scan = await scanWindowsEvents(options);
  const analyzed = analyzeEvents(scan.events, games, signatures);
  const groups = groupCrashes(analyzed);

  return {
    scannedAt: new Date().toISOString(),
    options,
    groups,
    totalEvents: analyzed.length,
    warnings: scan.warnings
  };
});

ipcMain.handle("export-report", async (_event, { result, format }) => {
  const extension = format === "txt" ? "txt" : "json";
  const event = result?.groups?.[0]?.representative;
  const reportName = event
    ? sanitizeFileName(`${event.displayName || event.processName || "crash"}-${event.categoryLabel || "report"}`)
    : "crash-detector-report";
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export crash report",
    defaultPath: `${reportName}.${extension}`,
    filters: [
      extension === "txt"
        ? { name: "Text report", extensions: ["txt"] }
        : { name: "JSON report", extensions: ["json"] }
    ]
  });
  if (canceled || !filePath) return { canceled: true };

  const content = extension === "txt" ? crashToPlainText(result) : exportPayload(result);
  fs.writeFileSync(filePath, content, "utf8");
  return { canceled: false, filePath };
});

async function scanWindowsEvents(options) {
  if (process.platform !== "win32") {
    return {
      events: [],
      warnings: ["Crash Detector reads Windows Event Viewer logs, so live scanning only works on Windows."]
    };
  }

  const days = Number(options.days || 7);
  const since = options.since || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const until = options.until || new Date().toISOString();
  const processFilter = String(options.processFilter || "").trim();
  const includeSystem = options.includeSystem !== false;
  const includeHealthChecks = options.includeHealthChecks !== false;

  const ps = buildPowerShellScanner({ since, until, includeSystem, includeHealthChecks });
  const output = await runPowerShell(ps);
  const parsed = output.trim() ? JSON.parse(output) : [];
  const rawEvents = Array.isArray(parsed) ? parsed : [parsed];

  const events = rawEvents
    .map((item) => enrichEventFromMessage({
      timestamp: normalizeTimestamp(item.TimeCreated),
      logName: item.LogName,
      providerName: item.ProviderName,
      eventId: Number(item.Id),
      level: item.LevelDisplayName || "Information",
      message: item.Message || "",
      rawXml: item.Xml || "",
      eventData: item.EventData || {},
      propertyValues: item.Properties || []
    }))
    .filter((event) => !processFilter || (event.processName || "").toLowerCase().includes(processFilter.toLowerCase()));

  return { events, warnings: [] };
}

function buildPowerShellScanner({ since, until, includeSystem, includeHealthChecks }) {
  const appProviders = [
    ["Application", 1000],
    ["Application", 1002],
    ["Application", 1001],
    ["Application", 1026]
  ];
  const systemProviders = includeSystem ? [
    ["System", 1001],
    ["System", 41],
    ["System", 6008]
  ] : [];
  const healthProviders = includeHealthChecks ? [
    ["System", 4101],
    ["System", 7],
    ["System", 51],
    ["System", 18],
    ["System", 7000],
    ["System", 7001],
    ["System", 7031],
    ["System", 7034]
  ] : [];

  const queries = [...appProviders, ...systemProviders, ...healthProviders]
    .map(([log, id]) => `@{ LogName = '${escapePs(log)}'; Id = ${id}; StartTime = $since; EndTime = $until }`)
    .join(",");

  return `
$ErrorActionPreference = 'SilentlyContinue'
$since = [datetime]'${escapePs(since)}'
$until = [datetime]'${escapePs(until)}'
$filters = @(${queries})
$events = foreach ($filter in $filters) {
  Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | ForEach-Object {
    $xmlText = $_.ToXml()
    $eventData = @{}
    try {
      $xml = [xml]$xmlText
      $index = 0
      foreach ($node in @($xml.Event.EventData.Data)) {
        $name = if ($node.Name) { [string]$node.Name } else { "P$index" }
        $eventData[$name] = [string]$node.'#text'
        $index++
      }
    } catch {}
    [pscustomobject]@{
      TimeCreated = $_.TimeCreated.ToString('o')
      LogName = $_.LogName
      ProviderName = $_.ProviderName
      Id = $_.Id
      LevelDisplayName = $_.LevelDisplayName
      Message = $_.Message
      Properties = @($_.Properties | ForEach-Object { $_.Value })
      EventData = $eventData
      Xml = $xmlText
    }
  }
}
$events | Sort-Object TimeCreated -Descending | ConvertTo-Json -Depth 6
`;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `PowerShell exited with ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function escapePs(value) {
  return String(value).replace(/'/g, "''");
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") {
    const msMatch = value.match(/\/Date\((\d+)\)\//);
    if (msMatch) return new Date(Number(msMatch[1])).toISOString();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80) || "crash-detector-report";
}
