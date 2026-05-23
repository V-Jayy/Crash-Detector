const CATEGORY_LABELS = {
  "gpu-driver": "Graphics driver",
  directx: "DirectX",
  anticheat: "Anti-cheat",
  "corrupt-files": "Corrupt files",
  memory: "Memory",
  "dotnet-runtime": ".NET runtime",
  "power-or-overclock": "Power / overclock",
  "network-or-launcher": "Launcher / network",
  "access-violation": "Access violation",
  "system-driver": "System driver",
  runtime: "Windows runtime",
  storage: "Storage",
  hardware: "Hardware",
  "application-bug": "Application bug",
  unknown: "Unknown"
};

function analyzeEvent(event, games, signatures) {
  const enriched = {
    ...event,
    category: "unknown",
    confidence: "Low",
    evidence: [],
    followUpChecks: [],
    sources: [],
    detailedExplanation: null,
    matchedSignatureTitle: null
  };

  enriched.matchedGame = findGame(enriched, games);

  applyEventDefinition(enriched, signatures);
  applyExceptionCode(enriched, signatures);
  applyModuleHeuristics(enriched, signatures);
  applyBugCheck(enriched, signatures);
  applySystemEvent(enriched);
  applyGameKnowledge(enriched);

  if (enriched.category === "unknown") {
    enriched.detailedExplanation ||= "This crash does not match a documented signature yet. The safest next step is to compare repeated events: same process, same module, same exception code, and same time window. A single unknown Application Error is weak evidence; a repeated signature is worth deeper debugging.";
    enriched.evidence.push("No documented exception, module, game, or bug check signature matched.");
    enriched.followUpChecks.push("Export this crash and compare it with the next occurrence.");
  }

  enriched.categoryLabel = CATEGORY_LABELS[enriched.category] || CATEGORY_LABELS.unknown;
  enriched.displayName = enriched.matchedGame?.displayName || enriched.processName || enriched.providerName;
  return enriched;
}

function analyzeEvents(events, games, signatures) {
  return events.map((event) => analyzeEvent(event, games, signatures));
}

function findGame(event, games) {
  const process = (event.processName || "").toLowerCase();
  const moduleName = (event.faultingModule || "").toLowerCase();

  return games.find((game) => {
    const names = game.processNames || [];
    return names.some((name) => {
      const lower = name.toLowerCase();
      return process === lower || process.includes(lower.replace(/\.exe$/, "")) || moduleName.includes(lower);
    });
  }) || null;
}

function applyEventDefinition(event, signatures) {
  const def = (signatures.eventDefinitions || []).find((item) =>
    item.eventId === event.eventId
    && sameProvider(item.providerName, event.providerName)
    && (!item.logName || item.logName === event.logName)
  );

  if (!def) return;
  event.eventKind = def.kind;
  event.evidence.push(`${def.providerName} ${def.eventId}: ${def.explanation}`);
}

function applyExceptionCode(event, signatures) {
  if (!event.exceptionCode) return;
  const match = (signatures.exceptionCodes || []).find((item) => sameHex(item.code, event.exceptionCode));
  if (!match) return;
  applyKnowledgeMatch(event, match, `Exception ${match.code} (${match.name}) matched.`);
}

function applyBugCheck(event, signatures) {
  if (!event.bugCheckCode) return;
  const match = (signatures.bugChecks || []).find((item) => sameHex(item.code, event.bugCheckCode));
  if (!match) return;
  applyKnowledgeMatch(event, match, `BugCheck ${match.code} (${match.name}) matched.`);
}

function applyModuleHeuristics(event, signatures) {
  if (!event.faultingModule) return;
  const moduleName = event.faultingModule.toLowerCase();
  const match = (signatures.moduleHeuristics || []).find((item) => moduleName.includes(item.contains.toLowerCase()));
  if (!match) return;
  applyKnowledgeMatch(event, match, `Faulting module contains "${match.contains}".`);
}

function applySystemEvent(event) {
  if (event.eventId === 41 || event.eventId === 6008) {
    event.category = "power-or-overclock";
    event.confidence = maxConfidence(event.confidence, "Medium");
    event.detailedExplanation ||= "This is a system-level shutdown/reboot marker. It tells you the machine did not stop cleanly, but it does not prove power loss by itself. Check the surrounding minutes for BugCheck 1001, WHEA hardware errors, Display 4101 resets, disk warnings, and thermal or overclock changes.";
    event.evidence.push(`System event ${event.eventId} marks an unclean shutdown path.`);
    event.followUpChecks.push("Scan the same time range with system checks enabled and review nearby hardware, display, and disk events.");
  }

  if (/WHEA-Logger/i.test(event.providerName || "")) {
    event.category = "hardware";
    event.confidence = maxConfidence(event.confidence, "High");
    event.detailedExplanation ||= "A WHEA event means Windows received a hardware error report. If this lines up with game crashes, treat stability, BIOS, CPU, RAM, PCIe, and GPU hardware paths as suspects before blaming the game.";
    event.followUpChecks.push("Review the WHEA message for APIC ID, cache hierarchy, PCIe, or memory clues.");
  }

  if (/Disk/i.test(event.providerName || "")) {
    event.category = "storage";
    event.confidence = maxConfidence(event.confidence, "Medium");
    event.detailedExplanation ||= "A disk warning near a crash can make game assets, shader caches, save files, or the page file unreliable. Storage events are worth checking before repeated repair installs.";
    event.followUpChecks.push("Check SMART health and run the game from a known-good disk if the warnings repeat.");
  }
}

function applyGameKnowledge(event) {
  const game = event.matchedGame;
  if (!game) return;

  event.evidence.push(`Matched installed/supported game profile: ${game.displayName}.`);
  event.sources.push(...(game.sources || []));

  const signature = (game.knownCrashes || []).find((item) => knownCrashMatches(event, item));
  if (signature) {
    event.category = signature.category || event.category;
    event.confidence = maxConfidence(event.confidence, "High");
    event.matchedSignatureTitle = signature.title;
    event.detailedExplanation = signature.explanation || event.detailedExplanation;
    event.evidence.push(...(signature.evidence || []));
    event.followUpChecks.push(...(signature.checks || []));
    event.sources.push(...(signature.sources || []));
  } else if (event.category === "unknown" && (game.commonCauses || []).length) {
    event.confidence = maxConfidence(event.confidence, "Medium");
    event.detailedExplanation ||= `${game.displayName} matched the process name, but this exact crash signature is not documented yet. Common areas for this title include ${game.commonCauses.join(", ")}. Use the module and exception code to narrow it down before taking broad repair steps.`;
  }
}

function knownCrashMatches(event, signature) {
  if (signature.exceptionCode && !sameHex(signature.exceptionCode, event.exceptionCode)) return false;
  if (signature.bugCheckCode && !sameHex(signature.bugCheckCode, event.bugCheckCode)) return false;
  if (signature.faultingModuleContains) {
    const needle = signature.faultingModuleContains.toLowerCase();
    const haystack = `${event.faultingModule || ""} ${event.message || ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return Boolean(signature.exceptionCode || signature.bugCheckCode || signature.faultingModuleContains);
}

function applyKnowledgeMatch(event, match, evidence) {
  event.category = match.category || event.category;
  event.confidence = maxConfidence(event.confidence, match.confidence || "Medium");
  event.detailedExplanation = match.explanation || event.detailedExplanation;
  event.evidence.push(evidence);
  event.followUpChecks.push(...(match.checks || []));
  event.sources.push(...(match.sources || []));
}

function sameHex(left, right) {
  if (!left || !right) return false;
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function sameProvider(expected, actual) {
  if (!expected) return true;
  return String(actual || "").toLowerCase().includes(String(expected).toLowerCase());
}

function maxConfidence(left, right) {
  const order = { Low: 1, Medium: 2, High: 3 };
  return (order[right] || 1) > (order[left] || 1) ? right : left;
}

module.exports = {
  CATEGORY_LABELS,
  analyzeEvent,
  analyzeEvents
};
