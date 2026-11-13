/* Read Core Attributes from Solana devnet. No keys required. */
'use strict';

const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { fetchAsset, mplCore } = require('@metaplex-foundation/mpl-core');
const { Connection } = require('@solana/web3.js');
const { DEVNET_RPC, DEVNET_GENESIS, ASSET, SLOTS, stateId } = require('./config');

let genesisChecked = false;

async function assertDevnet() {
  if (genesisChecked) return;
  if (!String(DEVNET_RPC).includes('devnet')) {
    throw new Error(`Refusing to run: RPC is not devnet (${DEVNET_RPC})`);
  }
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error(`Refusing to run: RPC genesis is not Solana devnet (${genesis})`);
  }
  genesisChecked = true;
}

function listToMap(list) {
  const map = {};
  for (const item of list || []) map[item.key] = item.value;
  return map;
}

async function readFlags() {
  await assertDevnet();
  const umi = createUmi(DEVNET_RPC).use(mplCore());
  const asset = await fetchAsset(umi, ASSET);
  const list = (asset.attributes && asset.attributes.attributeList) || [];
  const map = listToMap(list);
  return {
    cluster: 'devnet',
    assetAddress: ASSET,
    name: asset.name,
    uri: asset.uri,
    flags: map,
    stateId: stateId(map),
    slots: SLOTS,
  };
}

module.exports = { readFlags };
