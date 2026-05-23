const WER_MERGE_WINDOW_MS = 5 * 60 * 1000;

function signatureKey(event) {
  return [
    event.processName || event.providerName || "unknown",
    event.faultingModule || "unknown",
    event.exceptionCode || event.bugCheckCode || event.eventId || "unknown"
  ].join("|").toLowerCase();
}

function groupCrashes(events) {
  const buckets = new Map();

  for (const event of events) {
    if (!event.eventId) continue;
    if (!event.processName && !event.faultingModule && !event.bugCheckCode) continue;

    const key = signatureKey(event);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  }

  const groups = [...buckets.entries()].map(([signature, groupEvents]) => {
    const ordered = groupEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return {
      signature,
      representative: pickRepresentative(ordered),
      events: ordered
    };
  });

  return mergeWerPairs(groups)
    .map((group) => ({
      ...group,
      count: group.events.length,
      firstSeen: group.events[group.events.length - 1]?.timestamp,
      lastSeen: group.events[0]?.timestamp
    }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen) || b.count - a.count);
}

function pickRepresentative(events) {
  return events.find((event) => event.eventId === 1000 && /Application Error/i.test(event.providerName || ""))
    || events.find((event) => event.faultingModule)
    || events[0];
}

function mergeWerPairs(groups) {
  const used = new Set();
  const merged = [];

  for (let i = 0; i < groups.length; i += 1) {
    if (used.has(i)) continue;
    let current = groups[i];

    for (let j = i + 1; j < groups.length; j += 1) {
      if (used.has(j)) continue;
      if (!shouldMerge(current, groups[j])) continue;
      current = combineGroups(current, groups[j]);
      used.add(j);
    }

    merged.push(current);
  }

  return merged;
}

function shouldMerge(a, b) {
  const procA = a.representative.processName;
  const procB = b.representative.processName;
  if (!procA || !procB || procA.toLowerCase() !== procB.toLowerCase()) return false;

  const delta = Math.abs(new Date(a.events[0].timestamp) - new Date(b.events[0].timestamp));
  if (delta > WER_MERGE_WINDOW_MS) return false;

  const ids = new Set([a.representative.eventId, b.representative.eventId]);
  return ids.has(1000) && ids.has(1001);
}

function combineGroups(a, b) {
  const events = [...a.events, ...b.events].sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  return {
    signature: a.signature,
    representative: pickRepresentative(events),
    events
  };
}

module.exports = { groupCrashes, signatureKey };
