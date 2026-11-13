'use strict';
const { readFlags } = require('../../lib/read-flags');
const { TICKET_NAME, TICKET_REF, SLOTS, cacheHeaders, corsHeaders, publicBase, ASSET } = require('../../lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
  try {
    const data = await readFlags();
    const base = publicBase(event);
    const image = `${base}/render/${TICKET_REF}.png`;
    const animation = `${base}/`;
    const etag = `"meta-${data.stateId}-${data.flags.checkins || '0'}"`;
    if (event.headers['if-none-match'] === etag) {
      return { statusCode: 304, headers: cacheHeaders(etag), body: '' };
    }
    const attrOrder = [...SLOTS, 'checkins', 'finale', 'ticket_ref', 'last_event_code'];
    const seen = new Set();
    const attributes = [];
    for (const key of attrOrder) {
      if (data.flags[key] === undefined) continue;
      seen.add(key);
      attributes.push({ trait_type: key, value: String(data.flags[key]) });
    }
    for (const [key, value] of Object.entries(data.flags)) {
      if (seen.has(key)) continue;
      attributes.push({ trait_type: key, value: String(value) });
    }
    const body = {
      name: TICKET_NAME,
      symbol: 'PTIX',
      description:
        'Optional collectible tied to a Private Tickets check-in. Entry is the rotating QR, not this NFT. A Solana devnet prototype for Breakpoint 2026.',
      image,
      animation_url: animation,
      external_url: animation,
      attributes,
      properties: {
        files: [
          { uri: image, type: 'image/png' },
          { uri: animation, type: 'text/html' },
        ],
        category: 'image',
      },
      collection: { name: 'Breakpoint Test Tickets', family: 'Private Tickets' },
    };
    return {
      statusCode: 200,
      headers: { ...cacheHeaders(etag), 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body, null, 2),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
