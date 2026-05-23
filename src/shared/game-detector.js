const fs = require("fs");
const path = require("path");
const os = require("os");

function detectInstalledGames(games) {
  const candidates = [
    ...detectSteamGames(games),
    ...detectEpicGames(games),
    ...detectByCommonPaths(games)
  ];

  const byId = new Map();
  for (const item of candidates) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function detectSteamGames(games) {
  const steamRoot = findSteamRoot();
  if (!steamRoot) return [];

  const libraries = findSteamLibraries(steamRoot);
  const found = [];

  for (const library of libraries) {
    const steamapps = path.join(library, "steamapps");
    for (const game of games.filter((entry) => entry.steamAppId)) {
      const manifest = path.join(steamapps, `appmanifest_${game.steamAppId}.acf`);
      if (!fs.existsSync(manifest)) continue;
      const text = safeRead(manifest);
      const installDir = text.match(/"installdir"\s+"([^"]+)"/i)?.[1];
      found.push({
        id: game.id,
        displayName: game.displayName,
        launcher: "Steam",
        confidence: installDir ? "High" : "Medium",
        installPath: installDir ? path.join(steamapps, "common", installDir) : library,
        processNames: game.processNames
      });
    }
  }

  return found;
}

function detectEpicGames(games) {
  const programData = process.env.ProgramData || "C:\\ProgramData";
  const manifestsDir = path.join(programData, "Epic", "EpicGamesLauncher", "Data", "Manifests");
  if (!fs.existsSync(manifestsDir)) return [];

  const manifests = fs.readdirSync(manifestsDir)
    .filter((file) => file.toLowerCase().endsWith(".item"))
    .map((file) => safeJson(path.join(manifestsDir, file)))
    .filter(Boolean);

  const found = [];
  for (const manifest of manifests) {
    const installPath = manifest.InstallLocation || manifest.InstallLocationOverride;
    const nameText = `${manifest.DisplayName || ""} ${manifest.AppName || ""}`.toLowerCase();
    for (const game of games) {
      const processMatch = (game.processNames || []).some((processName) =>
        installPath && fileExistsDeepEnough(installPath, processName)
      );
      const nameMatch = nameText.includes(game.displayName.toLowerCase());
      if (processMatch || nameMatch) {
        found.push({
          id: game.id,
          displayName: game.displayName,
          launcher: "Epic Games Launcher",
          confidence: processMatch ? "High" : "Medium",
          installPath,
          processNames: game.processNames
        });
      }
    }
  }
  return found;
}

function detectByCommonPaths(games) {
  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
    process.env.APPDATA,
    path.join(os.homedir(), "AppData", "Local")
  ].filter(Boolean);

  const found = [];
  for (const game of games) {
    for (const marker of game.installMarkers || []) {
      for (const root of roots) {
        const possible = path.join(root, marker);
        if (!fs.existsSync(possible)) continue;
        found.push({
          id: game.id,
          displayName: game.displayName,
          launcher: game.launcher || "Detected path",
          confidence: "Medium",
          installPath: fs.statSync(possible).isDirectory() ? possible : path.dirname(possible),
          processNames: game.processNames
        });
      }
    }
  }
  return found;
}

function findSteamRoot() {
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || "", "Steam"),
    path.join(process.env.ProgramFiles || "", "Steam"),
    "C:\\Program Files (x86)\\Steam"
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(path.join(candidate, "steamapps"))) || null;
}

function findSteamLibraries(steamRoot) {
  const libraries = new Set([steamRoot]);
  const vdf = safeRead(path.join(steamRoot, "steamapps", "libraryfolders.vdf"));
  const matches = vdf.matchAll(/"path"\s+"([^"]+)"/gi);
  for (const match of matches) libraries.add(match[1].replace(/\\\\/g, "\\"));
  return [...libraries].filter(Boolean);
}

function fileExistsDeepEnough(root, fileName) {
  if (!root || !fs.existsSync(root)) return false;
  const direct = path.join(root, fileName);
  if (fs.existsSync(direct)) return true;
  const markers = [
    path.join(root, "Binaries", "Win64", fileName),
    path.join(root, "game", "bin", "win64", fileName),
    path.join(root, "FortniteGame", "Binaries", "Win64", fileName),
    path.join(root, "ShooterGame", "Binaries", "Win64", fileName)
  ];
  return markers.some((marker) => fs.existsSync(marker));
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function safeJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

module.exports = { detectInstalledGames };
