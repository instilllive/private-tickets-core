#!/usr/bin/env node
'use strict';

/**
 * Step (b): set a flag (default door=1), confirm via RPC read, render a local composite.
 * Devnet only. Never prints secret key material.
 */

const path = require('path');
const { spawnSync } = require('child_process');
const {
  DEVNET_RPC,
  confirmDevnetConnection,
  makeUmi,
  loadAssetRecord,
  loadKeypair,
  AUTHORITY_KEY,
  errMessage,
  explorerTx,
  ROOT,
  writeJson,
} = require('./lib/cluster');
const { readAttributes } = require('./lib/updater');
const { applyCheckin, writeFlag } = require('./lib/updater');
const { stateId } = require('./lib/attributes');

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

function renderComposite(map, outPath) {
  const script = path.join(ROOT, 'lib', 'composite.py');
  const r = spawnSync('python3', [script, '--flags', JSON.stringify(map), '--out', outPath], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`composite failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

async function tryDas(assetAddress) {
  // Public devnet RPC does not speak DAS. Try a couple of known DAS-capable
  // endpoints if the caller set DAS_RPC; otherwise report skipped.
  const url = process.env.DAS_RPC;
  if (!url) {
    return { attempted: false, reason: 'DAS_RPC not set; public api.devnet.solana.com has no getAsset' };
  }
  if (!String(url).includes('devnet')) {
    return { attempted: false, reason: 'Refusing DAS_RPC that is not devnet' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: assetAddress },
      }),
    });
    const json = await res.json();
    if (json.error) return { attempted: true, ok: false, error: json.error };
    return { attempted: true, ok: true, result: json.result };
  } catch (err) {
    return { attempted: true, ok: false, error: errMessage(err) };
  }
}

async function main() {
  await confirmDevnetConnection(DEVNET_RPC);
  const record = loadAssetRecord();
  const key = arg('key', arg('slot', 'door'));
  const value = arg('value', '1');
  const dryRun = hasFlag('dry-run');
  const asCheckin = hasFlag('checkin') || (key === 'door' && value === '1' && !hasFlag('set'));

  let result;
  if (hasFlag('set') || !['door', 'side_a', 'side_b', 'side_c', 'side_d'].includes(key)) {
    result = await writeFlag({ key, value, dryRun, preferDelegate: !hasFlag('authority') });
  } else if (asCheckin && value === '1') {
    result = await applyCheckin({ slot: key, eventCode: arg('event', key), dryRun, preferDelegate: !hasFlag('authority') });
  } else {
    result = await writeFlag({ key, value, dryRun, preferDelegate: !hasFlag('authority') });
  }

  process.stdout.write(`${result.reason}\n`);
  process.stdout.write(`signer: ${result.signerRole}\n`);
  process.stdout.write(`before: ${JSON.stringify(result.before)}\n`);
  process.stdout.write(`after:  ${JSON.stringify(result.after)}\n`);
  if (result.signature) {
    process.stdout.write(`tx: ${result.signature}\n`);
    process.stdout.write(`explorer: ${result.explorer}\n`);
  } else if (dryRun) {
    process.stdout.write('dry-run: no transaction sent\n');
  } else if (!result.changed) {
    process.stdout.write('no-op: no transaction sent\n');
  }

  const umi = makeUmi(loadKeypair(AUTHORITY_KEY).secretKey);
  const confirmed = await readAttributes(umi, record.assetAddress);
  process.stdout.write(`rpc read: ${JSON.stringify(confirmed.map)}\n`);
  process.stdout.write(`state: ${stateId(confirmed.map)}\n`);

  const das = await tryDas(record.assetAddress);
  if (das.attempted && das.ok) process.stdout.write('DAS getAsset: ok\n');
  else process.stdout.write(`DAS: ${das.reason || das.error || 'unavailable'}\n`);

  const outPath = arg('out', path.join(ROOT, 'renders', `state_${stateId(confirmed.map)}.png`));
  const rendered = renderComposite(confirmed.map, outPath);
  process.stdout.write(`composite: ${rendered}\n`);

  const receiptPath = path.join(ROOT, 'renders', 'last-update.json');
  writeJson(receiptPath, {
    ...result,
    rpcRead: confirmed.map,
    das,
    composite: outPath,
    confirmedAt: new Date().toISOString(),
  });
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${errMessage(err)}\n`);
  process.exit(1);
});
