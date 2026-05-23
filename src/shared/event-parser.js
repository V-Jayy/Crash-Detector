function normalizeHex(value) {
  if (!value) return null;
  let text = String(value).trim().toLowerCase();
  if (!text) return null;
  text = text.replace(/^0x0x/, "0x");
  if (/^\d+$/.test(text)) {
    return `0x${Number(text).toString(16).padStart(8, "0")}`;
  }
  return text.startsWith("0x") ? text : `0x${text}`;
}

function matchValue(message, pattern) {
  if (!message) return null;
  const match = String(message).match(pattern);
  return match?.[1]?.trim() || null;
}

function sanitizeFaultingModule(moduleName) {
  if (!moduleName) return null;
  const clean = String(moduleName).trim();
  if (!clean || /^unknown$/i.test(clean) || /^P\d+:/i.test(clean)) return null;
  return clean;
}

function parseApplicationError(message) {
  return {
    processName: matchValue(message, /Faulting application name:\s*([^,\r\n]+)/i),
    faultingModule: sanitizeFaultingModule(matchValue(message, /Faulting module name:\s*([^,\r\n]+)/i)),
    exceptionCode: normalizeHex(matchValue(message, /Exception code:\s*(0x[0-9a-f]+)/i)),
    faultOffset: normalizeHex(matchValue(message, /Fault offset:\s*(0x[0-9a-f]+)/i))
  };
}

function parseApplicationErrorFields(event) {
  const data = event.eventData || {};
  const props = event.propertyValues || [];
  return {
    processName: data.AppName || props[0] || null,
    faultingModule: sanitizeFaultingModule(data.ModuleName || props[3] || null),
    exceptionCode: normalizeHex(data.ExceptionCode || props[6] || null),
    faultOffset: normalizeHex(data.FaultingOffset || props[7] || null),
    applicationPath: data.AppPath || props[10] || null,
    modulePath: data.ModulePath || props[11] || null,
    reportId: data.IntegratorReportId || props[12] || null
  };
}

function parseWerFields(event) {
  const data = event.eventData || {};
  return {
    processName: data.P1 || data.AppName || null,
    faultingModule: sanitizeFaultingModule(data.P4 || data.ModuleName || null),
    eventName: data.EventName || null
  };
}

function parseWer(message) {
  return {
    processName: matchValue(message, /\bP1:\s*([^\r\n]+)/i),
    faultingModule: sanitizeFaultingModule(matchValue(message, /\bP4:\s*([^\r\n]*)/i)),
    eventName: matchValue(message, /Event Name:\s*([^\r\n]+)/i)
  };
}

function parseBugCheckCode(message) {
  return normalizeHex(matchValue(message, /bugcheck was:\s*(0x[0-9a-f]+)/i));
}

function enrichEventFromMessage(event) {
  const provider = event.providerName || "";
  const message = event.message || "";

  if (event.eventId === 1000 || event.eventId === 1002) {
    const parsed = parseApplicationError(message);
    const fields = parseApplicationErrorFields(event);
    Object.assign(event, {
      ...parsed,
      processName: fields.processName || parsed.processName,
      faultingModule: fields.faultingModule || parsed.faultingModule,
      exceptionCode: fields.exceptionCode || parsed.exceptionCode,
      faultOffset: fields.faultOffset || parsed.faultOffset,
      applicationPath: fields.applicationPath,
      modulePath: fields.modulePath,
      reportId: fields.reportId
    });
  }

  if (provider.includes("Windows Error Reporting") && event.eventId === 1001) {
    const wer = parseWer(message);
    const fields = parseWerFields(event);
    event.processName ||= fields.processName || wer.processName;
    event.faultingModule ||= fields.faultingModule || wer.faultingModule;
    event.werEventName ||= fields.eventName || wer.eventName;
  }

  if (/BugCheck/i.test(provider) || /bugcheck/i.test(message)) {
    event.bugCheckCode ||= normalizeHex(event.eventData?.BugcheckCode || event.propertyValues?.[0]) || parseBugCheckCode(message);
    event.processName ||= "System (BugCheck)";
  }

  if (event.eventId === 1026) {
    event.processName ||= firstMeaningfulLine(message) || ".NET Application";
    event.exceptionCode ||= "0xe0434352";
  }

  if (event.eventId === 41) event.processName ||= "System (Unexpected reboot)";
  if (event.eventId === 6008) event.processName ||= "System (Unexpected shutdown)";
  if (event.eventId === 4101) event.processName ||= "Display driver";
  if (/WHEA-Logger/i.test(provider)) event.processName ||= "Hardware error";
  if (/Disk/i.test(provider)) event.processName ||= "Storage subsystem";

  return event;
}

function firstMeaningfulLine(message) {
  return String(message || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || null;
}

module.exports = {
  enrichEventFromMessage,
  normalizeHex,
  parseApplicationError,
  parseApplicationErrorFields,
  parseBugCheckCode,
  parseWerFields,
  parseWer,
  sanitizeFaultingModule
};
