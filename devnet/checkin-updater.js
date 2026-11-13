#!/usr/bin/env node
'use strict';

/**
 * Check-in hook used by Private Tickets (dry-run or real devnet updatePlugin).
 * A replayed check-in (flag already 1, or --replay) is a no-op.
 * Never prints secret key material.
 */

const { applyCheckin, errMessage } = require('./lib/updater');
const { loadAssetRecord } = require('./lib/cluster');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  return fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const replay = hasFlag('replay');
  const slot = arg('slot', 'door');
  const ticketRef = arg('ticket-ref', '');
  const ticketId = arg('ticket-id', '');
  const record = loadAssetRecord();
  if (ticketRef && ticketRef !== record.ticketRef) {
    throw new Error(`Unknown ticket_ref ${ticketRef} (this prototype maps only ${record.ticketRef})`);
  }

  if (replay) {
    const result = await applyCheckin({ slot, dryRun: true, eventCode: arg('event', slot) });
    result.dryRun = dryRun;
    result.changed = false;
    result.reason = 'replayed check-in: no-op';
    result.signature = null;
    result.explorer = null;
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  const result = await applyCheckin({
    slot,
    eventCode: arg('event', slot),
    dryRun,
  });
  result.ticketId = ticketId || undefined;
  result.ticketRef = record.ticketRef;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ ok: false, error: errMessage(err) }) + '\n');
  process.exit(1);
});
