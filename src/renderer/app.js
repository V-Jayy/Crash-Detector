const state = {
  result: null,
  selectedIndex: 0,
  isScanning: false,
  detectedGames: null
};

const api = window.crashDetector || createPreviewBridge();

const els = {
  days: document.querySelector("#days"),
  processFilter: document.querySelector("#processFilter"),
  includeSystem: document.querySelector("#includeSystem"),
  includeHealthChecks: document.querySelector("#includeHealthChecks"),
  scanButton: document.querySelector("#scanButton"),
  chooseExeButton: document.querySelector("#chooseExeButton"),
  detectGamesButton: document.querySelector("#detectGamesButton"),
  refreshGamesButton: document.querySelector("#refreshGamesButton"),
  gamesPanel: document.querySelector("#gamesPanel"),
  installedGames: document.querySelector("#installedGames"),
  gamePopover: document.querySelector("#gamePopover"),
  closeGamePopover: document.querySelector("#closeGamePopover"),
  customExeForm: document.querySelector("#customExeForm"),
  customExeInput: document.querySelector("#customExeInput"),
  gameMenuList: document.querySelector("#gameMenuList"),
  gameMenuStatus: document.querySelector("#gameMenuStatus"),
  minimizeWindow: document.querySelector("#minimizeWindow"),
  maximizeWindow: document.querySelector("#maximizeWindow"),
  closeWindow: document.querySelector("#closeWindow"),
  title: document.querySelector("#title"),
  totalCrashes: document.querySelector("#totalCrashes"),
  totalEvents: document.querySelector("#totalEvents"),
  signatureCount: document.querySelector("#signatureCount"),
  scanWindow: document.querySelector("#scanWindow"),
  scanAnimation: document.querySelector("#scanAnimation"),
  scanStatus: document.querySelector("#scanStatus"),
  resultCount: document.querySelector("#resultCount"),
  resultsList: document.querySelector("#resultsList"),
  detailPanel: document.querySelector("#detailPanel")
};

els.scanButton.addEventListener("click", () => runScan());
els.chooseExeButton.addEventListener("click", chooseExecutable);
els.detectGamesButton.addEventListener("click", () => {
  if (state.detectedGames) openGamesMenu();
  else detectGames();
});
els.refreshGamesButton.addEventListener("click", detectGames);
els.closeGamePopover.addEventListener("click", closeGamesMenu);
els.customExeForm.addEventListener("submit", scanCustomExe);
els.minimizeWindow.addEventListener("click", () => api.windowControl("minimize"));
els.maximizeWindow.addEventListener("click", () => api.windowControl("maximize"));
els.closeWindow.addEventListener("click", () => api.windowControl("close"));
els.detailPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-export-format]");
  if (!button) return;
  exportReport(button.dataset.exportFormat, Number(button.dataset.groupIndex));
});
els.days.addEventListener("change", () => {
  els.scanButton.textContent = `Scan last ${formatDayLabel(els.days.value)}`;
  els.scanWindow.textContent = `${els.days.value}d`;
});

document.addEventListener("DOMContentLoaded", () => {
  runScan({ auto: true });
});

async function runScan(overrides = {}) {
  setBusy(true);
  try {
    const days = Number(els.days.value || 30);
    const result = await api.scan({
      days,
      processFilter: els.processFilter.value.trim(),
      includeSystem: els.includeSystem.checked,
      includeHealthChecks: els.includeHealthChecks.checked,
      ...overrides
    });
    state.result = result;
    state.selectedIndex = 0;
    renderResult(result);
  } catch (error) {
    renderError(error);
  } finally {
    setBusy(false);
  }
}

async function chooseExecutable() {
  const picked = await api.pickExecutable();
  if (!picked) return;
  els.processFilter.value = picked.processName;
  await runScan({ processFilter: picked.processName, pickedExecutable: picked.filePath });
}

async function detectGames() {
  els.installedGames.className = "game-summary empty";
  els.installedGames.textContent = "Checking known launcher locations...";
  openGamesMenu();
  els.gameMenuStatus.textContent = "Checking Steam, Epic, and common install markers...";
  els.gameMenuList.innerHTML = `<div class="menu-empty">Scanning installed games...</div>`;
  try {
    const games = await api.detectGames();
    state.detectedGames = games;
    renderInstalledGames(games);
  } catch (error) {
    els.installedGames.textContent = error.message || "Game detection failed.";
    els.gameMenuStatus.textContent = "Game detection failed.";
    els.gameMenuList.innerHTML = `<div class="menu-empty">${escapeHtml(error.message || "Game detection failed.")}</div>`;
  }
}

async function exportReport(format, groupIndex = state.selectedIndex) {
  if (!state.result) return;
  const group = state.result.groups?.[groupIndex];
  if (!group) return;

  await api.exportReport({
    result: {
      ...state.result,
      groups: [group],
      totalEvents: group.events?.length || group.count || 0
    },
    format
  });
}

function renderResult(result) {
  const groups = result.groups || [];

  els.title.textContent = groups.length ? "Crash signatures found" : "No matching crashes found";
  els.totalCrashes.textContent = groups.length;
  els.totalEvents.textContent = result.totalEvents || 0;
  els.signatureCount.textContent = groups.length;
  els.scanWindow.textContent = `${result.options?.days || els.days.value}d`;
  els.resultCount.textContent = groups.length ? `${groups.length} grouped` : "No results";

  if (!groups.length) {
    els.resultsList.innerHTML = "";
    els.detailPanel.innerHTML = `
      <div class="empty-detail">
        <div class="empty-icon ok" aria-hidden="true">OK</div>
        <h3>No crash signatures in this window</h3>
        <p>Try choosing a specific executable, widening the lookback, or scanning again after reproducing the crash.</p>
      </div>
    `;
    return;
  }

  els.resultsList.innerHTML = groups.map((group, index) => renderResultItem(group, index)).join("");
  els.resultsList.querySelectorAll(".result-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedIndex = Number(button.dataset.index);
      renderSelection();
    });
  });
  renderSelection();
}

function renderSelection() {
  const groups = state.result?.groups || [];
  const group = groups[state.selectedIndex];
  if (!group) return;

  els.resultsList.querySelectorAll(".result-item").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.index) === state.selectedIndex);
  });
  els.detailPanel.innerHTML = renderDetail(group, state.selectedIndex);
}

function renderResultItem(group, index) {
  const event = group.representative;
  const moduleName = event.faultingModule || event.bugCheckCode || event.providerName || "Unknown signature";
  return `
    <button class="result-item" data-index="${index}" data-category="${escapeHtml(event.category)}" type="button">
      <span class="severity">${escapeHtml(event.confidence || "Low")}</span>
      <strong>${escapeHtml(event.displayName || "Unknown crash")}</strong>
      <span>${escapeHtml(event.categoryLabel || "Unknown")} - ${escapeHtml(moduleName)}</span>
      <small>${formatDate(group.lastSeen)} - ${group.count} event${group.count === 1 ? "" : "s"}</small>
    </button>
  `;
}

function renderDetail(group, index) {
  const event = group.representative;
  const details = [
    ["Process", event.processName || "Unknown"],
    ["Module", event.faultingModule || "Unknown"],
    ["Exception", event.exceptionCode || "None"],
    ["BugCheck", event.bugCheckCode || "None"],
    ["Provider", `${event.providerName || "Unknown"} ${event.eventId || ""}`],
    ["Report", event.reportId || event.werEventName || "None"]
  ];

  return `
    <div class="detail-head" data-category="${escapeHtml(event.category)}">
      <div>
        <p class="kicker">${escapeHtml(event.categoryLabel || "Unknown")}</p>
        <h3>${escapeHtml(event.displayName || "Unknown crash")}</h3>
        <span>${formatDate(group.lastSeen)} - ${group.count} related event${group.count === 1 ? "" : "s"}</span>
      </div>
      <div class="detail-actions">
        <div class="confidence-pill">${escapeHtml(event.confidence || "Low")} confidence</div>
        <button class="secondary compact" type="button" data-export-format="txt" data-group-index="${index}">Save TXT</button>
        <button class="secondary compact" type="button" data-export-format="json" data-group-index="${index}">Save JSON</button>
      </div>
    </div>

    <section class="explain-block">
      <h4>What this probably means</h4>
      <p>${escapeHtml(event.detailedExplanation || "No explanation available yet.")}</p>
    </section>

    <section class="fact-grid">
      ${details.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <code title="${escapeHtml(value)}">${escapeHtml(value)}</code>
        </div>
      `).join("")}
    </section>

    <section class="two-column">
      <div>
        <h4>Evidence</h4>
        <ul>${listItems(event.evidence)}</ul>
      </div>
      <div>
        <h4>Follow-up checks</h4>
        <ul>${listItems(event.followUpChecks)}</ul>
      </div>
    </section>

    <details class="raw-events">
      <summary>Raw events in this signature</summary>
      <pre>${escapeHtml(group.events.map(formatRawEvent).join("\n\n---\n\n"))}</pre>
    </details>
  `;
}

function renderInstalledGames(games) {
  if (!games.length) {
    els.installedGames.className = "game-summary empty";
    els.installedGames.textContent = "No supported installs found.";
    els.gameMenuStatus.textContent = "No supported installs found in known launcher locations.";
    els.gameMenuList.innerHTML = `<div class="menu-empty">Pick a specific EXE or add a game profile in data/games.json.</div>`;
    return;
  }

  els.installedGames.className = "game-summary";
  els.installedGames.textContent = `${games.length} supported install${games.length === 1 ? "" : "s"} detected`;
  els.gameMenuStatus.textContent = `${games.length} detected. Choose one to filter the next scan.`;
  els.gameMenuList.innerHTML = games.map((game) => `
    <button class="game-row" type="button" data-process="${escapeHtml(game.processNames?.[0] || "")}">
      <strong>${escapeHtml(game.displayName)}</strong>
      <span>${escapeHtml(game.launcher || "Detected")} - ${escapeHtml(game.confidence || "Medium")}</span>
    </button>
  `).join("");

  els.gameMenuList.querySelectorAll(".game-row").forEach((button) => {
    button.addEventListener("click", () => {
      els.processFilter.value = button.dataset.process || "";
      closeGamesMenu();
      runScan();
    });
  });
}

function openGamesMenu() {
  els.gamePopover.hidden = false;
  positionGamesMenu();
  window.addEventListener("resize", positionGamesMenu);
}

function closeGamesMenu() {
  els.gamePopover.hidden = true;
  window.removeEventListener("resize", positionGamesMenu);
}

function positionGamesMenu() {
  const shell = document.querySelector(".app-shell");
  if (!shell || !els.gamesPanel) return;

  const shellRect = shell.getBoundingClientRect();
  const panelRect = els.gamesPanel.getBoundingClientRect();
  const gap = 16;
  const left = panelRect.right - shellRect.left + gap;
  const preferredTop = panelRect.top - shellRect.top;
  const maxHeight = Math.max(260, shellRect.bottom - panelRect.top - 20);
  const top = Math.max(12, Math.min(preferredTop, shellRect.height - Math.min(maxHeight, 430) - 12));

  els.gamePopover.style.left = `${Math.round(left)}px`;
  els.gamePopover.style.top = `${Math.round(top)}px`;
  els.gamePopover.style.maxHeight = `${Math.round(maxHeight)}px`;
}

async function scanCustomExe(event) {
  event.preventDefault();
  const value = els.customExeInput.value.trim();
  if (!value) return;
  els.processFilter.value = value;
  closeGamesMenu();
  await runScan({ processFilter: value, customProcess: value });
}

function renderError(error) {
  els.title.textContent = "Scan failed";
  els.resultCount.textContent = "Error";
  els.resultsList.innerHTML = "";
  els.detailPanel.innerHTML = `
    <div class="empty-detail">
      <div class="empty-icon" aria-hidden="true">!</div>
      <h3>Could not scan Event Viewer</h3>
      <p>${escapeHtml(error.message || String(error))}</p>
    </div>
  `;
}

function setBusy(isBusy) {
  state.isScanning = isBusy;
  els.scanButton.disabled = isBusy;
  els.chooseExeButton.disabled = isBusy;
  els.detectGamesButton.disabled = isBusy;
  els.scanButton.textContent = isBusy ? "Scanning..." : `Scan last ${formatDayLabel(els.days.value)}`;
  els.scanAnimation.classList.toggle("active", isBusy);
  if (isBusy) {
    els.title.textContent = `Scanning the last ${formatDayLabel(els.days.value)}`;
    els.resultCount.textContent = "Scanning";
    els.scanStatus.textContent = "Reading structured EventData first, then falling back to message text.";
  }
}

function formatDayLabel(days) {
  const value = Number(days || 30);
  return `${value} day${value === 1 ? "" : "s"}`;
}

function listItems(items = []) {
  if (!items.length) return "<li>No specific items captured yet.</li>";
  return [...new Set(items)].slice(0, 7).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function formatRawEvent(item) {
  const pieces = [
    `[${item.timestamp}] ${item.providerName} ${item.eventId}`,
    item.processName ? `Process: ${item.processName}` : "",
    item.faultingModule ? `Module: ${item.faultingModule}` : "",
    item.exceptionCode ? `Exception: ${item.exceptionCode}` : "",
    item.bugCheckCode ? `BugCheck: ${item.bugCheckCode}` : "",
    item.message || ""
  ].filter(Boolean);
  return pieces.join("\n");
}

function formatDate(value) {
  if (!value) return "Unknown time";
  const normalized = normalizeDateInput(value);
  if (!normalized) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(normalized);
}

function normalizeDateInput(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "string") {
    const msMatch = value.match(/\/Date\((\d+)\)\//);
    const parsed = msMatch ? new Date(Number(msMatch[1])) : new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createPreviewBridge() {
  return {
    async scan(options) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const now = new Date().toISOString();
      return {
        scannedAt: now,
        options,
        totalEvents: 3,
        warnings: [],
        groups: [
          {
            signature: "FortniteClient-Win64-Shipping.exe|nvwgf2umx.dll|0xc0000005",
            count: 2,
            firstSeen: now,
            lastSeen: now,
            representative: {
              timestamp: now,
              providerName: "Application Error",
              eventId: 1000,
              displayName: "Fortnite",
              processName: "FortniteClient-Win64-Shipping.exe",
              faultingModule: "nvwgf2umx.dll",
              exceptionCode: "0xc0000005",
              category: "gpu-driver",
              categoryLabel: "Graphics driver",
              confidence: "High",
              matchedGame: { displayName: "Fortnite" },
              detailedExplanation: "The structured EventData points to Fortnite crashing inside NVIDIA's user-mode graphics driver. That usually means the rendering path failed during gameplay, shader work, or presentation. The game is the app that fell over, but this signature is stronger evidence for the graphics stack than for a random Fortnite reinstall.",
              evidence: [
                "Application Error 1000 contained AppName, ModuleName, and ExceptionCode fields.",
                "Faulting module contains nvwgf2umx.",
                "Exception 0xc0000005 matched STATUS_ACCESS_VIOLATION."
              ],
              followUpChecks: [
                "Check whether Display 4101 appears near the same time.",
                "Clean-install the GPU driver if this repeats.",
                "Disable overlays for one launch test."
              ],
              message: "Preview data. Electron scans real Event Viewer records."
            },
            events: [
              {
                timestamp: now,
                providerName: "Application Error",
                eventId: 1000,
                processName: "FortniteClient-Win64-Shipping.exe",
                faultingModule: "nvwgf2umx.dll",
                exceptionCode: "0xc0000005",
                message: "Preview data. Electron scans real Event Viewer records."
              }
            ]
          }
        ]
      };
    },
    async detectGames() {
      return [
        { displayName: "Counter-Strike 2", launcher: "Steam", confidence: "High", processNames: ["cs2.exe"] },
        { displayName: "Fortnite", launcher: "Epic Games Launcher", confidence: "Medium", processNames: ["FortniteClient-Win64-Shipping.exe"] }
      ];
    },
    async pickExecutable() {
      return null;
    },
    async exportReport() {
      return { canceled: true };
    },
    async windowControl() {
      return true;
    }
  };
}
