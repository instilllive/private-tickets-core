/* Shared devnet-only helpers. Never prints secret key material. */
'use strict';

const fs = require('fs');
const path = require('path');
const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity } = require('@metaplex-foundation/umi');
const { mplCore } = require('@metaplex-foundation/mpl-core');
const { base58 } = require('@metaplex-foundation/umi/serializers');

const DEVNET_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const CLUSTER = 'devnet';
const ROOT = path.join(__dirname, '..');
const KEYS_DIR = path.join(ROOT, 'keys');
const AUTHORITY_KEY = path.join(KEYS_DIR, 'mark-authority-devnet.json');
const DELEGATE_KEY = path.join(KEYS_DIR, 'sync-delegate-devnet.json');
const GUEST_KEY = path.join(KEYS_DIR, 'guest-devnet.json');
const COLLECTION_JSON = path.join(ROOT, 'collection.json');
const ASSET_JSON = path.join(ROOT, 'asset.json');

function assertDevnet(rpc = DEVNET_RPC) {
  if (!String(rpc).includes('devnet')) {
    throw new Error(`Refusing to run: RPC is not devnet (${rpc})`);
  }
}

function errMessage(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  return err.message || String(err);
}

function encodeSig(signature) {
  if (typeof signature === 'string') return signature;
  return base58.deserialize(signature)[0];
}

function explorerAddress(addr) {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function ensureKeysDir() {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(KEYS_DIR, 0o700);
}

function loadKeypair(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(`Key file is not a 64-byte Solana keypair array: ${path.basename(filePath)}`);
  }
  fs.chmodSync(filePath, 0o600);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function loadOrCreateKeypair(filePath) {
  ensureKeysDir();
  if (fs.existsSync(filePath)) return { keypair: loadKeypair(filePath), created: false };
  const kp = Keypair.generate();
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
  return { keypair: kp, created: true };
}

function loadCollectionRecord() {
  if (!fs.existsSync(COLLECTION_JSON)) {
    throw new Error(`Missing ${COLLECTION_JSON}. Step 1 must be done first.`);
  }
  return JSON.parse(fs.readFileSync(COLLECTION_JSON, 'utf8'));
}

function loadAssetRecord() {
  if (!fs.existsSync(ASSET_JSON)) {
    throw new Error(`Missing ${ASSET_JSON}. Mint the test asset first.`);
  }
  return JSON.parse(fs.readFileSync(ASSET_JSON, 'utf8'));
}

function writeJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o644 });
  fs.renameSync(tmp, filePath);
}

async function confirmDevnetConnection(rpc = DEVNET_RPC) {
  assertDevnet(rpc);
  const connection = new Connection(rpc, 'confirmed');
  const genesis = await connection.getGenesisHash();
  if (genesis !== DEVNET_GENESIS) {
    throw new Error(`Refusing to run: RPC genesis hash is not Solana devnet (${genesis})`);
  }
  return { connection, genesis };
}

function makeUmi(secretKey, rpc = DEVNET_RPC) {
  assertDevnet(rpc);
  const umi = createUmi(rpc).use(mplCore());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  umi.use(keypairIdentity(umiKeypair));
  return umi;
}

async function getBalanceSol(connection, pubkey) {
  const lamports = await connection.getBalance(pubkey, 'confirmed');
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}

async function transferSol(connection, from, to, sol) {
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports })
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [from], { commitment: 'confirmed' });
  return sig;
}

async function ensureFunded(connection, funder, target, minSol = 0.02, topUpSol = 0.05) {
  const starting = await getBalanceSol(connection, target.publicKey);
  if (starting.sol >= minSol) {
    return { funded: false, signature: null, balance: starting };
  }
  const sig = await transferSol(connection, funder, target.publicKey, topUpSol);
  const balance = await getBalanceSol(connection, target.publicKey);
  return { funded: true, signature: sig, balance };
}

module.exports = {
  DEVNET_RPC,
  DEVNET_GENESIS,
  CLUSTER,
  ROOT,
  KEYS_DIR,
  AUTHORITY_KEY,
  DELEGATE_KEY,
  GUEST_KEY,
  COLLECTION_JSON,
  ASSET_JSON,
  assertDevnet,
  errMessage,
  encodeSig,
  explorerAddress,
  explorerTx,
  ensureKeysDir,
  loadKeypair,
  loadOrCreateKeypair,
  loadCollectionRecord,
  loadAssetRecord,
  writeJson,
  confirmDevnetConnection,
  makeUmi,
  getBalanceSol,
  transferSol,
  ensureFunded,
  PublicKey,
  LAMPORTS_PER_SOL,
};
