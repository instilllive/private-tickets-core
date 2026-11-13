/* Progress-flag helpers for the Core Attributes plugin. No personal data. */
'use strict';

const SLOTS = ['door', 'side_a', 'side_b', 'side_c', 'side_d'];

function defaultAttributes(ticketRef) {
  return [
    { key: 'door', value: '0' },
    { key: 'side_a', value: '0' },
    { key: 'side_b', value: '0' },
    { key: 'side_c', value: '0' },
    { key: 'side_d', value: '0' },
    { key: 'checkins', value: '0' },
    { key: 'last_event_code', value: '' },
    { key: 'ticket_ref', value: ticketRef },
  ];
}

function listToMap(list) {
  const map = {};
  for (const item of list || []) map[item.key] = item.value;
  return map;
}

function mapToList(map, currentList) {
  const seen = new Set();
  const out = [];
  for (const item of currentList || []) {
    seen.add(item.key);
    out.push({
      key: item.key,
      value: map[item.key] !== undefined ? String(map[item.key]) : item.value,
    });
  }
  for (const [key, value] of Object.entries(map)) {
    if (!seen.has(key)) out.push({ key, value: String(value) });
  }
  return out;
}

function attributesFromAsset(asset) {
  const list = asset && asset.attributes && asset.attributes.attributeList;
  if (Array.isArray(list)) return list.map((a) => ({ key: a.key, value: a.value }));
  return [];
}

function applySlot(list, slot, extra = {}) {
  if (!SLOTS.includes(slot) && slot !== 'finale') {
    throw new Error(`Unknown slot: ${slot}`);
  }
  const map = listToMap(list);
  if (SLOTS.includes(slot) && map[slot] === '1') {
    return { list, map, changed: false, reason: `slot ${slot} already 1` };
  }
  if (slot === 'finale') {
    throw new Error('finale is computed from the five slot flags; do not set it directly');
  }
  map[slot] = '1';
  map.checkins = String(Number(map.checkins || '0') + 1);
  map.last_event_code = extra.eventCode || slot;
  if (SLOTS.every((s) => map[s] === '1')) map.finale = '1';
  else if (map.finale) map.finale = '0';
  return { list: mapToList(map, list), map, changed: true, reason: `set ${slot}=1` };
}

function setFlag(list, key, value) {
  const map = listToMap(list);
  const next = String(value);
  if (map[key] === next) {
    return { list, map, changed: false, reason: `${key} already ${next}` };
  }
  map[key] = next;
  if (SLOTS.every((s) => map[s] === '1')) map.finale = '1';
  else map.finale = '0';
  return { list: mapToList(map, list), map, changed: true, reason: `set ${key}=${next}` };
}

function stateId(map) {
  return SLOTS.map((s) => (map[s] === '1' ? '1' : '0')).join('');
}

module.exports = {
  SLOTS,
  defaultAttributes,
  listToMap,
  mapToList,
  attributesFromAsset,
  applySlot,
  setFlag,
  stateId,
};
