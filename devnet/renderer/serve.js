#!/usr/bin/env node
'use strict';

/**
 * Local renderer + check-in hook endpoint. Devnet reads only, plus optional
 * updatePlugin when POST /checkin is called. Never prints secrets.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { applyCheckin, readAttributes, errMessage } = require('../lib/updater');
const {
  DEVNET_RPC,
  confirmDevnetConnection,
  makeUmi,
  loadAssetRecord,
  loadKeypair,
  AUTHORITY_KEY,
  explorerAddress,
  ROOT,
} = require('../lib/cluster');
const { stateId } = require('../lib/attributes');

const HOST = process.env.RENDERER_HOST || '127.0.0.1';
const PORT = Number(process.env.RENDERER_PORT || 8787);
const PUBLIC = path.join(__dirname, 'public');
const TICKET_PNG = path.join(PUBLIC, 'ticket.png');
const DEFAULT_FLAGS = {
  door: '0', side_a: '0', side_b: '0', side_c: '0', side_d: '0', checkins: '0',
};

let cache = {
  flags: DEFAULT_FLAGS,
  stateId: '00000',
  assetAddress: null,
  explorer: null,
  updatedAt: null,
  lastReason: 'starting',
  lastSignature: null,
  lastDryRun: false,
  lastChanged: false,
};

function compositeTo(map) {
  const script = path.join(ROOT, 'lib', 'composite.py');
  const r = spawnSync('python3', [script, '--flags', JSON.stringify(map), '--out', TICKET_PNG], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'composite failed');
}

async function refreshFlags() {
  const record = loadAssetRecord();
  const umi = makeUmi(loadKeypair(AUTHORITY_KEY).secretKey);
  const { map } = await readAttributes(umi, record.assetAddress);
  const sid = stateId(map);
  if (sid !== cache.stateId || !fs.existsSync(TICKET_PNG)) compositeTo(map);
  cache.flags = map;
  cache.stateId = sid;
  cache.assetAddress = record.assetAddress;
  cache.explorer = explorerAddress(record.assetAddress);
  cache.updatedAt = new Date().toISOString();
  return cache;
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(data);
}

function sendFile(res, filePath, type) {
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(buf);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

async function handleCheckin(body) {
  const slot = body.slot || 'door';
  const dryRun = body.dryRun === true || process.env.SOLANA_NFT_DRY_RUN === '1';
  const replay = body.replay === true;
  if (replay) {
    await refreshFlags();
    cache.lastReason = 'replayed check-in: no-op';
    cache.lastSignature = null;
    cache.lastDryRun = dryRun;
    cache.lastChanged = false;
    return { ...cache, changed: false, reason: cache.lastReason, dryRun, signature: null };
  }
  const result = await applyCheckin({ slot, eventCode: body.eventCode || slot, dryRun });
  if (result.changed && !dryRun) await refreshFlags();
  else await refreshFlags();
  cache.lastReason = result.reason;
  cache.lastSignature = result.signature;
  cache.lastDryRun = result.dryRun;
  cache.lastChanged = result.changed;
  return { ...result, flags: cache.flags, stateId: cache.stateId };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return sendFile(res, path.join(PUBLIC, 'index.html'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/ticket.png') {
      if (!fs.existsSync(TICKET_PNG)) compositeTo(cache.flags);
      return sendFile(res, TICKET_PNG, 'image/png');
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return send(res, 200, cache);
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, cluster: 'devnet', port: PORT });
    }
    if (req.method === 'POST' && url.pathname === '/checkin') {
      const body = await readBody(req);
      const result = await handleCheckin(body);
      return send(res, 200, result);
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: errMessage(err) });
  }
});

async function start() {
  await confirmDevnetConnection(DEVNET_RPC);
  try {
    await refreshFlags();
  } catch (err) {
    // Asset may not be minted yet; serve empty flags until it is.
    cache.lastReason = `waiting for asset: ${errMessage(err)}`;
    try { compositeTo(cache.flags); } catch (_) { /* ignore */ }
  }
  server.listen(PORT, HOST, () => {
    process.stdout.write(`Renderer listening on http://${HOST}:${PORT} (devnet only)\n`);
  });
}

start().catch((err) => {
  process.stderr.write(`ERROR: ${errMessage(err)}\n`);
  process.exit(1);
});
