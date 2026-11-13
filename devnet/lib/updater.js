/* Idempotent Attributes updatePlugin helper. Devnet only. */
'use strict';

const { fetchAsset, fetchCollection, updatePlugin } = require('@metaplex-foundation/mpl-core');
const {
  DEVNET_RPC,
  encodeSig,
  explorerTx,
  loadAssetRecord,
  loadKeypair,
  makeUmi,
  confirmDevnetConnection,
  DELEGATE_KEY,
  AUTHORITY_KEY,
  errMessage,
} = require('./cluster');
const { applySlot, setFlag, attributesFromAsset, listToMap, stateId } = require('./attributes');

async function readAttributes(umi, assetAddress) {
  const asset = await fetchAsset(umi, assetAddress);
  const list = attributesFromAsset(asset);
  return { asset, list, map: listToMap(list) };
}

function pickSigner(preferDelegate = true) {
  if (preferDelegate) {
    try {
      return { keypair: loadKeypair(DELEGATE_KEY), role: 'update-delegate' };
    } catch (err) {
      // Fall through to authority.
    }
  }
  return { keypair: loadKeypair(AUTHORITY_KEY), role: 'update-authority' };
}

async function sendAttributeUpdate(umi, assetAddress, collectionAddress, list) {
  const result = await updatePlugin(umi, {
    asset: assetAddress,
    collection: collectionAddress,
    plugin: {
      type: 'Attributes',
      attributeList: list,
    },
  }).sendAndConfirm(umi);
  return encodeSig(result.signature);
}

/**
 * Apply a check-in slot (door, side_a, ...). If the flag is already 1, this is a no-op.
 * dryRun: describe the planned change without sending a transaction.
 */
async function applyCheckin({ slot = 'door', eventCode, dryRun = false, preferDelegate = true } = {}) {
  await confirmDevnetConnection(DEVNET_RPC);
  const record = loadAssetRecord();
  const signer = pickSigner(preferDelegate);
  const umi = makeUmi(signer.keypair.secretKey);
  const before = await readAttributes(umi, record.assetAddress);
  const planned = applySlot(before.list, slot, { eventCode });

  const result = {
    cluster: 'devnet',
    assetAddress: record.assetAddress,
    collectionAddress: record.collectionAddress,
    signerRole: signer.role,
    slot,
    dryRun,
    changed: planned.changed,
    reason: planned.reason,
    before: before.map,
    after: planned.map,
    stateIdBefore: stateId(before.map),
    stateIdAfter: stateId(planned.map),
    signature: null,
    explorer: null,
  };

  if (!planned.changed) return result;
  if (dryRun) return result;

  const signature = await sendAttributeUpdate(
    umi,
    record.assetAddress,
    record.collectionAddress,
    planned.list
  );
  const after = await readAttributes(umi, record.assetAddress);
  result.signature = signature;
  result.explorer = explorerTx(signature);
  result.after = after.map;
  result.stateIdAfter = stateId(after.map);
  result.confirmed = after.map[slot] === '1';
  return result;
}

/** Direct flag write, used by the step-2 script and test resets. */
async function writeFlag({ key, value, dryRun = false, preferDelegate = true } = {}) {
  await confirmDevnetConnection(DEVNET_RPC);
  const record = loadAssetRecord();
  const signer = pickSigner(preferDelegate);
  const umi = makeUmi(signer.keypair.secretKey);
  const before = await readAttributes(umi, record.assetAddress);
  const planned = setFlag(before.list, key, value);
  const result = {
    cluster: 'devnet',
    assetAddress: record.assetAddress,
    collectionAddress: record.collectionAddress,
    signerRole: signer.role,
    dryRun,
    changed: planned.changed,
    reason: planned.reason,
    before: before.map,
    after: planned.map,
    stateIdBefore: stateId(before.map),
    stateIdAfter: stateId(planned.map),
    signature: null,
    explorer: null,
  };
  if (!planned.changed || dryRun) return result;
  const signature = await sendAttributeUpdate(
    umi,
    record.assetAddress,
    record.collectionAddress,
    planned.list
  );
  const after = await readAttributes(umi, record.assetAddress);
  result.signature = signature;
  result.explorer = explorerTx(signature);
  result.after = after.map;
  result.stateIdAfter = stateId(after.map);
  result.confirmed = after.map[key] === String(value);
  return result;
}

module.exports = { applyCheckin, writeFlag, readAttributes, pickSigner, errMessage };
