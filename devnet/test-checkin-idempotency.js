#!/usr/bin/env node
'use strict';

/**
 * Dry-run, real updatePlugin, and replay/idempotency for the check-in updater.
 * Resets door=0 first (setup tx), then:
 *   1) dry-run first check-in (no tx, would set door=1)
 *   2) real first check-in (sends updatePlugin)
 *   3) replayed check-in (no-op, no tx)
 * Devnet only.
 */

const assert = require('node:assert/strict');
const { writeFlag, applyCheckin, readAttributes } = require('./lib/updater');
const { confirmDevnetConnection, DEVNET_RPC, makeUmi, loadKeypair, AUTHORITY_KEY, loadAssetRecord, explorerTx } = require('./lib/cluster');
const { stateId } = require('./lib/attributes');

function summarize(label, result) {
  process.stdout.write(
    `${label}: changed=${result.changed} dryRun=${!!result.dryRun} sig=${result.signature || 'none'} reason=${result.reason}\n`
  );
}

async function main() {
  await confirmDevnetConnection(DEVNET_RPC);
  const record = loadAssetRecord();
  const umi = makeUmi(loadKeypair(AUTHORITY_KEY).secretKey);

  process.stdout.write('Setup: reset door=0 if needed...\n');
  const reset = await writeFlag({ key: 'door', value: '0', preferDelegate: true });
  summarize('reset', reset);
  if (reset.signature) process.stdout.write(`  explorer: ${reset.explorer}\n`);

  let { map } = await readAttributes(umi, record.assetAddress);
  assert.equal(map.door, '0', 'door should be 0 before tests');
  const checkinsBefore = Number(map.checkins || '0');

  process.stdout.write('\n1) Dry-run first check-in...\n');
  const dry = await applyCheckin({ slot: 'door', eventCode: 'door', dryRun: true });
  summarize('dry-run', dry);
  assert.equal(dry.changed, true, 'dry-run should report a pending change');
  assert.equal(dry.signature, null, 'dry-run must not send a transaction');
  assert.equal(dry.after.door, '1');
  ({ map } = await readAttributes(umi, record.assetAddress));
  assert.equal(map.door, '0', 'on-chain door must still be 0 after dry-run');

  process.stdout.write('\n2) Real first check-in...\n');
  const real = await applyCheckin({ slot: 'door', eventCode: 'door', dryRun: false });
  summarize('real', real);
  assert.equal(real.changed, true, 'first check-in should change the flag');
  assert.ok(real.signature, 'first check-in must send updatePlugin');
  process.stdout.write(`  explorer: ${real.explorer}\n`);
  ({ map } = await readAttributes(umi, record.assetAddress));
  assert.equal(map.door, '1', 'rpc read: door=1 after first check-in');
  assert.equal(Number(map.checkins), checkinsBefore + 1);

  process.stdout.write('\n3) Replayed check-in (idempotent no-op)...\n');
  const replay = await applyCheckin({ slot: 'door', eventCode: 'door', dryRun: false });
  summarize('replay', replay);
  assert.equal(replay.changed, false, 'replay must be a no-op');
  assert.equal(replay.signature, null, 'replay must not send a transaction');
  assert.match(replay.reason, /already 1/);
  const afterReplay = await readAttributes(umi, record.assetAddress);
  assert.deepEqual(afterReplay.map, map, 'flags must be unchanged after replay');
  assert.equal(stateId(afterReplay.map), '10000');

  process.stdout.write('\nPASS: dry-run, real updatePlugin, and replay no-op all behaved as expected.\n');
  process.stdout.write(JSON.stringify({
    resetTx: reset.signature,
    resetExplorer: reset.explorer,
    dryRunTx: dry.signature,
    realTx: real.signature,
    realExplorer: real.explorer,
    replayTx: replay.signature,
    finalFlags: afterReplay.map,
  }, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`FAIL: ${err.stack || err.message || err}\n`);
  process.exit(1);
});
