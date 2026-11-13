#!/usr/bin/env node
'use strict';

/**
 * Mint one Metaplex Core test asset on Solana devnet, with the Attributes
 * plugin and an Update Delegate. Also attaches a collection Update Delegate
 * (sync-server hot key). Never prints secret key material. Refuses to run
 * if asset.json already exists.
 */

const { generateSigner, publicKey } = require('@metaplex-foundation/umi');
const {
  addCollectionPlugin,
  create,
  fetchAsset,
  fetchCollection,
} = require('@metaplex-foundation/mpl-core');
const {
  DEVNET_RPC,
  AUTHORITY_KEY,
  DELEGATE_KEY,
  GUEST_KEY,
  ASSET_JSON,
  loadKeypair,
  loadOrCreateKeypair,
  loadCollectionRecord,
  writeJson,
  confirmDevnetConnection,
  makeUmi,
  encodeSig,
  explorerAddress,
  explorerTx,
  ensureFunded,
  getBalanceSol,
  errMessage,
} = require('./lib/cluster');
const { defaultAttributes, attributesFromAsset, listToMap } = require('./lib/attributes');
const fs = require('fs');

const TICKET_NAME = 'Breakpoint 2026 Ticket #1';
const TICKET_REF = 'devnet-ticket-001';
const PLACEHOLDER_URI = 'https://example.com/breakpoint-ticket-1.json';

async function main() {
  if (fs.existsSync(ASSET_JSON)) {
    throw new Error(`Refusing to mint a second asset: ${ASSET_JSON} already exists. Inspect it first.`);
  }

  const { connection, genesis } = await confirmDevnetConnection(DEVNET_RPC);
  process.stdout.write(`Confirmed cluster: devnet (genesis ${genesis})\n`);

  const collectionRecord = loadCollectionRecord();
  const collectionAddress = collectionRecord.collectionAddress;
  const authority = loadKeypair(AUTHORITY_KEY);
  const delegate = loadOrCreateKeypair(DELEGATE_KEY);
  const guest = loadOrCreateKeypair(GUEST_KEY);

  process.stdout.write(`Authority public key: ${authority.publicKey.toBase58()}\n`);
  process.stdout.write(`Update delegate public key: ${delegate.keypair.publicKey.toBase58()} (${delegate.created ? 'newly generated' : 'loaded'})\n`);
  process.stdout.write(`Guest owner public key: ${guest.keypair.publicKey.toBase58()} (${guest.created ? 'newly generated' : 'loaded'})\n`);

  const fundDelegate = await ensureFunded(connection, authority, delegate.keypair, 0.02, 0.05);
  if (fundDelegate.funded) {
    process.stdout.write(`Funded update delegate with 0.05 devnet SOL: ${explorerTx(fundDelegate.signature)}\n`);
  }
  process.stdout.write(`Delegate balance: ${fundDelegate.balance.sol} SOL\n`);

  const umi = makeUmi(authority.secretKey);
  const collection = await fetchCollection(umi, collectionAddress);
  if (collection.name !== collectionRecord.name && collection.name !== 'Breakpoint Test Tickets') {
    process.stdout.write(`Note: on-chain collection name is ${JSON.stringify(collection.name)}\n`);
  }

  const txs = [];

  // Collection-level Update Delegate so the hot key can update assets in the collection.
  if (collection.updateDelegate) {
    const existing = (collection.updateDelegate.additionalDelegates || []).map((d) => d.toString());
    process.stdout.write(`Collection already has Update Delegate; additionalDelegates: ${existing.join(', ') || '(none)'}\n`);
    if (!existing.includes(delegate.keypair.publicKey.toBase58())) {
      process.stdout.write('Warning: hot key is not in additionalDelegates. Leaving the existing plugin as-is.\n');
    }
  } else {
    process.stdout.write('Adding collection Update Delegate...\n');
    const addResult = await addCollectionPlugin(umi, {
      collection: collection.publicKey,
      plugin: {
        type: 'UpdateDelegate',
        additionalDelegates: [publicKey(delegate.keypair.publicKey.toBase58())],
      },
    }).sendAndConfirm(umi);
    const sig = encodeSig(addResult.signature);
    txs.push({ kind: 'addCollectionUpdateDelegate', signature: sig, explorer: explorerTx(sig) });
    process.stdout.write(`Collection Update Delegate tx: ${sig}\n`);
  }

  const assetSigner = generateSigner(umi);
  const assetAddress = assetSigner.publicKey.toString();
  const attrs = defaultAttributes(TICKET_REF);
  process.stdout.write(`Minting ${TICKET_NAME} at ${assetAddress}...\n`);

  const mintResult = await create(umi, {
    asset: assetSigner,
    name: TICKET_NAME,
    uri: PLACEHOLDER_URI,
    collection,
    owner: publicKey(guest.keypair.publicKey.toBase58()),
    plugins: [
      { type: 'Attributes', attributeList: attrs },
      {
        type: 'UpdateDelegate',
        additionalDelegates: [publicKey(delegate.keypair.publicKey.toBase58())],
      },
    ],
  }).sendAndConfirm(umi);

  const mintSig = encodeSig(mintResult.signature);
  txs.push({ kind: 'createAsset', signature: mintSig, explorer: explorerTx(mintSig) });
  process.stdout.write(`Mint tx: ${mintSig}\n`);

  const onChain = await fetchAsset(umi, assetSigner.publicKey);
  const list = attributesFromAsset(onChain);
  const map = listToMap(list);
  if (onChain.name !== TICKET_NAME) {
    throw new Error(`Verification failed: on-chain name is ${JSON.stringify(onChain.name)}`);
  }
  if (map.door !== '0' || map.ticket_ref !== TICKET_REF) {
    throw new Error(`Verification failed: unexpected attributes ${JSON.stringify(map)}`);
  }
  const owner = onChain.owner && onChain.owner.toString();
  if (owner !== guest.keypair.publicKey.toBase58()) {
    throw new Error(`Verification failed: owner ${owner} does not match guest`);
  }

  const authBal = await getBalanceSol(connection, authority.publicKey);
  const rec = {
    cluster: 'devnet',
    rpc: DEVNET_RPC,
    name: TICKET_NAME,
    uri: PLACEHOLDER_URI,
    ticketRef: TICKET_REF,
    assetAddress,
    collectionAddress,
    owner,
    updateAuthority: authority.publicKey.toBase58(),
    updateDelegate: delegate.keypair.publicKey.toBase58(),
    transactions: txs,
    attributes: map,
    explorer: {
      asset: explorerAddress(assetAddress),
      collection: explorerAddress(collectionAddress),
      mint: explorerTx(mintSig),
      owner: explorerAddress(owner),
      updateDelegate: explorerAddress(delegate.keypair.publicKey.toBase58()),
    },
    balanceAfterSol: authBal.sol,
    createdAt: new Date().toISOString(),
    verified: true,
  };
  writeJson(ASSET_JSON, rec);
  process.stdout.write('Verified on-chain asset:\n');
  process.stdout.write(`  name: ${onChain.name}\n`);
  process.stdout.write(`  asset: ${assetAddress}\n`);
  process.stdout.write(`  owner: ${owner}\n`);
  process.stdout.write(`  attributes: ${JSON.stringify(map)}\n`);
  process.stdout.write(`  has UpdateDelegate: ${Boolean(onChain.updateDelegate)}\n`);
  process.stdout.write(`Wrote ${ASSET_JSON}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${errMessage(err)}\n`);
  process.exit(1);
});
