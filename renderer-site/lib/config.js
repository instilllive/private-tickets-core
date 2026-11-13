/* Devnet renderer config. No keys. */
'use strict';

const DEVNET_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const ASSET = 'Cu4sj5yoPZjqukgBv6dnwuxGwF2w746zhWNML8RMr6rD';
const COLLECTION = 'Ck9qLRFXR3rdhuRk5A4XRUJzdFWyMveqranfBDhHLH4Z';
const TICKET_REF = 'devnet-ticket-001';
const TICKET_NAME = 'Breakpoint 2026 Ticket #1';
const SLOTS = ['door', 'side_a', 'side_b', 'side_c', 'side_d'];

function stateId(map) {
  return SLOTS.map((s) => (map[s] === '1' ? '1' : '0')).join('');
}

function publicBase(event) {
  const headers = event.headers || {};
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers.host || headers.Host;
  if (!host) return '';
  return `${proto}://${host}`;
}

function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type,if-none-match',
    ...extra,
  };
}

function cacheHeaders(etag) {
  return corsHeaders({
    'cache-control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=300',
    etag,
    vary: 'Accept',
  });
}

module.exports = {
  DEVNET_RPC,
  DEVNET_GENESIS,
  ASSET,
  COLLECTION,
  TICKET_REF,
  TICKET_NAME,
  SLOTS,
  stateId,
  publicBase,
  corsHeaders,
  cacheHeaders,
};
