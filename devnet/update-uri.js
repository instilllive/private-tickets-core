#!/usr/bin/env node
'use strict';

/**
 * Update the devnet asset metadata URI. Refuses non-devnet RPCs.
 * Never prints secret key material.
 */

const { update, fetchAsset, fetchCollection } = require('@metaplex-foundation/mpl-core');
const {
  DEVNET_RPC,
  confirmDevnetConnection,
  makeUmi,
  loadKeypair,
  loadAssetRecord,
  writeJson,
  ASSET_JSON,
  AUTHORITY_KEY,
  encodeSig,
  explorerTx,
  errMessage,
} = require('./lib/cluster');

async function main() {
  const uri = process.argv[2];
  if (!uri || !uri.startsWith('https://')) {
    throw new Error('Usage: node update-uri.js https://.../metadata/devnet-ticket-001.json');
  }
  if (uri.includes('1e0c39b4') || uri.includes('8b93637a') || uri.includes('6af36e4f0f0fdce9c2a62596')) {
    throw new Error('Refusing to point metadata at a protected existing site');
  }
  await confirmDevnetConnection(DEVNET_RPC);
  const rec = loadAssetRecord();
  const umi = makeUmi(loadKeypair(AUTHORITY_KEY).secretKey);
  const asset = await fetchAsset(umi, rec.assetAddress);
  const collection = await fetchCollection(umi, rec.collectionAddress);
  const before = { name: asset.name, uri: asset.uri };
  process.stdout.write(`Current URI: ${before.uri}\n`);
  process.stdout.write(`New URI: ${uri}\n`);
  const result = await update(umi, {
    asset,
    collection,
    uri,
  }).sendAndConfirm(umi);
  const sig = encodeSig(result.signature);
  process.stdout.write(`Update tx: ${sig}\n`);
  process.stdout.write(`Explorer: ${explorerTx(sig)}\n`);
  const after = await fetchAsset(umi, rec.assetAddress);
  if (after.uri !== uri) {
    throw new Error(`Verification failed: on-chain URI is ${JSON.stringify(after.uri)}`);
  }
  rec.uri = after.uri;
  rec.uriUpdate = { signature: sig, explorer: explorerTx(sig), updatedAt: new Date().toISOString() };
  writeJson(ASSET_JSON, rec);
  process.stdout.write(`Confirmed on-chain URI: ${after.uri}\n`);
  process.stdout.write(`Name unchanged: ${after.name}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${errMessage(err)}\n`);
  process.exit(1);
});
