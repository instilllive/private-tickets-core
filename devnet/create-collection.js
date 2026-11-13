'use strict';

/**
 * Step 1 only: create a Metaplex Core collection on Solana devnet.
 * Does not mint ticket assets. Never prints secret key material.
 */

const fs = require('fs');
const path = require('path');
const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { createCollection, fetchCollection, mplCore } = require('@metaplex-foundation/mpl-core');
const { generateSigner, keypairIdentity } = require('@metaplex-foundation/umi');
const { base58 } = require('@metaplex-foundation/umi/serializers');

const DEVNET_RPC = 'https://api.devnet.solana.com';
const CLUSTER = 'devnet';
const COLLECTION_NAME = 'Breakpoint Test Tickets';
const PLACEHOLDER_URI = 'https://example.com/breakpoint-test-tickets.json';

const ROOT = __dirname;
const KEYS_DIR = path.join(ROOT, 'keys');
const KEY_PATH = path.join(KEYS_DIR, 'mark-authority-devnet.json');
const COLLECTION_JSON_PATH = path.join(ROOT, 'collection.json');

function assertDevnet(rpc) {
  if (!rpc.includes('devnet')) {
    throw new Error(`Refusing to run: RPC is not devnet (${rpc})`);
  }
}

function ensureKeysDir() {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(KEYS_DIR, 0o700);
}

function loadOrCreateAuthority() {
  ensureKeysDir();
  if (fs.existsSync(KEY_PATH)) {
    const raw = fs.readFileSync(KEY_PATH, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error('Authority key file exists but is not a 64-byte Solana keypair array');
    }
    fs.chmodSync(KEY_PATH, 0o600);
    const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
    return { keypair: kp, created: false };
  }
  const kp = Keypair.generate();
  const tmp = KEY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, KEY_PATH);
  fs.chmodSync(KEY_PATH, 0o600);
  return { keypair: kp, created: true };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  return err.message || String(err);
}

async function getBalanceSol(connection, pubkey) {
  const lamports = await connection.getBalance(pubkey, 'confirmed');
  return { lamports, sol: lamports / LAMPORTS_PER_SOL };
}

async function requestAirdropOnce(connection, pubkey, lamports) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  const latest = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    'confirmed'
  );
  return sig;
}

async function fundFromDevnetAirdrop(connection, pubkey, minSol = 0.02) {
  const starting = await getBalanceSol(connection, pubkey);
  if (starting.sol >= minSol) {
    return { funded: false, alreadyFunded: true, signature: null, amountSol: 0, balance: starting, attempts: [] };
  }

  const amounts = [2, 1, 0.5, 0.25, 0.1];
  const attempts = [];
  let lastError = null;

  for (const amountSol of amounts) {
    for (let tryNum = 1; tryNum <= 3; tryNum++) {
      const label = `${amountSol} SOL try ${tryNum}`;
      process.stdout.write(`Airdrop request: ${label}...\n`);
      try {
        const sig = await requestAirdropOnce(connection, pubkey, Math.round(amountSol * LAMPORTS_PER_SOL));
        // Give the balance a moment to settle, then re-read
        await sleep(1000);
        const balance = await getBalanceSol(connection, pubkey);
        attempts.push({ amountSol, tryNum, ok: true, signature: sig });
        return { funded: true, alreadyFunded: false, signature: sig, amountSol, balance, attempts };
      } catch (err) {
        const msg = errMessage(err);
        attempts.push({ amountSol, tryNum, ok: false, error: msg });
        lastError = msg;
        process.stdout.write(`Airdrop failed (${label}): ${msg}\n`);
        await sleep(4000 * tryNum);
      }
    }
  }

  const balance = await getBalanceSol(connection, pubkey);
  if (balance.sol >= minSol) {
    return { funded: true, alreadyFunded: false, signature: null, amountSol: 0, balance, attempts };
  }
  const error = new Error(
    `Devnet airdrop blocked or rate-limited after retries. Last error: ${lastError}. Balance: ${balance.sol} SOL`
  );
  error.attempts = attempts;
  error.balance = balance;
  throw error;
}

function encodeSig(signature) {
  if (typeof signature === 'string') return signature;
  return base58.deserialize(signature)[0];
}

async function main() {
  assertDevnet(DEVNET_RPC);

  if (fs.existsSync(COLLECTION_JSON_PATH)) {
    throw new Error(
      `Refusing to create a second collection: ${COLLECTION_JSON_PATH} already exists. Inspect it first.`
    );
  }

  const { keypair: authority, created: keyCreated } = loadOrCreateAuthority();
  const authorityPubkey = authority.publicKey.toBase58();
  process.stdout.write(
    `Authority public key: ${authorityPubkey} (${keyCreated ? 'newly generated' : 'loaded existing file'})\n`
  );
  process.stdout.write(`Key file: ${KEY_PATH}\n`);

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const genesis = await connection.getGenesisHash();
  // Devnet genesis hash is EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG
  const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
  if (genesis !== DEVNET_GENESIS) {
    throw new Error(`Refusing to run: RPC genesis hash is not Solana devnet (${genesis})`);
  }
  process.stdout.write(`Confirmed cluster: devnet (genesis ${genesis})\n`);

  const funding = await fundFromDevnetAirdrop(connection, authority.publicKey, 0.02);
  process.stdout.write(`Devnet SOL balance: ${funding.balance.sol} SOL\n`);

  const umi = createUmi(DEVNET_RPC).use(mplCore());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(authority.secretKey);
  umi.use(keypairIdentity(umiKeypair));

  const collectionSigner = generateSigner(umi);
  const collectionAddress = collectionSigner.publicKey.toString();
  process.stdout.write(`Creating collection ${COLLECTION_NAME} at ${collectionAddress}...\n`);

  const result = await createCollection(umi, {
    collection: collectionSigner,
    name: COLLECTION_NAME,
    uri: PLACEHOLDER_URI,
    updateAuthority: umi.identity.publicKey,
  }).sendAndConfirm(umi);

  const txSignature = encodeSig(result.signature);
  process.stdout.write(`Create tx signature: ${txSignature}\n`);

  const onChain = await fetchCollection(umi, collectionSigner.publicKey);
  const updateAuthority = onChain.updateAuthority.toString();
  if (onChain.name !== COLLECTION_NAME) {
    throw new Error(`Verification failed: on-chain name is ${JSON.stringify(onChain.name)}`);
  }
  if (updateAuthority !== authorityPubkey) {
    throw new Error(
      `Verification failed: update authority ${updateAuthority} does not match Mark's key ${authorityPubkey}`
    );
  }

  const balanceAfter = await getBalanceSol(connection, authority.publicKey);

  const record = {
    cluster: CLUSTER,
    rpc: DEVNET_RPC,
    name: COLLECTION_NAME,
    uri: PLACEHOLDER_URI,
    collectionAddress,
    transactionSignature: txSignature,
    updateAuthority: authorityPubkey,
    authorityKeyPath: KEY_PATH,
    numMinted: Number(onChain.numMinted ?? 0),
    currentSize: Number(onChain.currentSize ?? 0),
    explorer: {
      collection: `https://explorer.solana.com/address/${collectionAddress}?cluster=devnet`,
      transaction: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      authority: `https://explorer.solana.com/address/${authorityPubkey}?cluster=devnet`,
    },
    airdrop: {
      requested: funding.funded,
      alreadyFunded: funding.alreadyFunded,
      amountSol: funding.amountSol,
      signature: funding.signature,
    },
    balanceAfterSol: balanceAfter.sol,
    createdAt: new Date().toISOString(),
    verified: true,
  };

  const tmpJson = COLLECTION_JSON_PATH + '.tmp';
  fs.writeFileSync(tmpJson, JSON.stringify(record, null, 2) + '\n', { mode: 0o644 });
  fs.renameSync(tmpJson, COLLECTION_JSON_PATH);

  process.stdout.write('Verified on-chain collection:\n');
  process.stdout.write(`  name: ${onChain.name}\n`);
  process.stdout.write(`  uri: ${onChain.uri}\n`);
  process.stdout.write(`  updateAuthority: ${updateAuthority}\n`);
  process.stdout.write(`  numMinted: ${record.numMinted}\n`);
  process.stdout.write(`  balance left: ${balanceAfter.sol} SOL\n`);
  process.stdout.write(`Wrote ${COLLECTION_JSON_PATH}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${errMessage(err)}\n`);
  process.exit(1);
});
