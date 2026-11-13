'use strict';
const { readFlags } = require('../../lib/read-flags');
const { ASSET, cacheHeaders, corsHeaders, publicBase } = require('../../lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
  try {
    const data = await readFlags();
    const base = publicBase(event);
    const etag = `"${data.stateId}-${data.flags.checkins || '0'}"`;
    if (event.headers['if-none-match'] === etag) {
      return { statusCode: 304, headers: cacheHeaders(etag), body: '' };
    }
    const body = {
      ...data,
      explorer: `https://explorer.solana.com/address/${ASSET}?cluster=devnet`,
      image: base ? `${base}/render/devnet-ticket-001.png` : '/render/devnet-ticket-001.png',
      updatedAt: new Date().toISOString(),
    };
    return {
      statusCode: 200,
      headers: { ...cacheHeaders(etag), 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
