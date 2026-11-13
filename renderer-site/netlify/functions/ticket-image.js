'use strict';
const fs = require('fs');
const path = require('path');
const { readFlags } = require('../../lib/read-flags');
const { cacheHeaders, corsHeaders } = require('../../lib/config');

function statePath(sid) {
  const file = `state_${sid}.png`;
  const candidates = [
    path.join(__dirname, 'states', file),
    path.join(process.cwd(), 'public', 'states', file),
    path.join(process.cwd(), 'states', file),
    path.join(__dirname, '..', '..', 'public', 'states', file),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
  try {
    const data = await readFlags();
    const file = statePath(data.stateId);
    if (!file) throw new Error(`missing state PNG for ${data.stateId}`);
    const etag = `"png-${data.stateId}"`;
    if (event.headers['if-none-match'] === etag) {
      return { statusCode: 304, headers: cacheHeaders(etag), body: '' };
    }
    const buf = fs.readFileSync(file);
    return {
      statusCode: 200,
      headers: {
        ...cacheHeaders(etag),
        'content-type': 'image/png',
        'content-disposition': 'inline; filename="breakpoint-ticket.png"',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }),
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
