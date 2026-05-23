function crashToPlainText(result) {
  const lines = [];
  lines.push("Crash Detector report");
  lines.push(`Scanned at: ${result.scannedAt}`);
  lines.push(`Events: ${result.totalEvents}`);
  lines.push("");

  for (const group of result.groups) {
    const event = group.representative;
    lines.push(`${event.displayName} - ${event.categoryLabel} (${event.confidence})`);
    lines.push(`Last seen: ${group.lastSeen} | Events: ${group.count}`);
    if (event.exceptionCode) lines.push(`Exception: ${event.exceptionCode}`);
    if (event.bugCheckCode) lines.push(`BugCheck: ${event.bugCheckCode}`);
    if (event.faultingModule) lines.push(`Faulting module: ${event.faultingModule}`);
    lines.push("");
    lines.push(event.detailedExplanation || "No detailed explanation available.");
    lines.push("");
    if (event.evidence?.length) {
      lines.push("Evidence:");
      event.evidence.forEach((item) => lines.push(`- ${item}`));
    }
    if (event.followUpChecks?.length) {
      lines.push("Follow-up checks:");
      event.followUpChecks.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
  }

  if (result.warnings?.length) {
    lines.push("Warnings:");
    result.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return lines.join("\r\n");
}

function exportPayload(result) {
  return JSON.stringify(result, null, 2);
}

module.exports = { crashToPlainText, exportPayload };
