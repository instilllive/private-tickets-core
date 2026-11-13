# Devnet prototype status

All work is on Solana devnet only (genesis `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`). No mainnet, no real funds. Secret keys stay in `a local keys/ directory (not in this repo) ` (chmod 700/600, gitignored) and are never printed or committed.

## Accounts

- Cluster: Solana devnet
- Collection: `Ck9qLRFXR3rdhuRk5A4XRUJzdFWyMveqranfBDhHLH4Z` (Breakpoint Test Tickets)
- Asset: `Cu4sj5yoPZjqukgBv6dnwuxGwF2w746zhWNML8RMr6rD` (Breakpoint 2026 Ticket #1, ticket_ref `devnet-ticket-001`)
- Update authority (cold): `GGh3g1EAHfbj6tnEDqivdLd82U2J7ZWr7nmducxfJBKo`
- Update delegate (hot, collection + asset): `B52kMbwTdtguVKCy2RnoX9pRU4B4k9JE5VyjxasS7Das`
- Guest owner: `HaFKU7KybamZohRcrVDYnAfs9v5dRfwYQXnyrikhUfcC`

## Explorers (devnet)

- Collection: https://explorer.solana.com/address/Ck9qLRFXR3rdhuRk5A4XRUJzdFWyMveqranfBDhHLH4Z?cluster=devnet
- Asset: https://explorer.solana.com/address/Cu4sj5yoPZjqukgBv6dnwuxGwF2w746zhWNML8RMr6rD?cluster=devnet
- Authority: https://explorer.solana.com/address/GGh3g1EAHfbj6tnEDqivdLd82U2J7ZWr7nmducxfJBKo?cluster=devnet
- Update delegate: https://explorer.solana.com/address/B52kMbwTdtguVKCy2RnoX9pRU4B4k9JE5VyjxasS7Das?cluster=devnet
- Guest owner: https://explorer.solana.com/address/HaFKU7KybamZohRcrVDYnAfs9v5dRfwYQXnyrikhUfcC?cluster=devnet

## Step 1 — collection (already done)

- Create collection: https://explorer.solana.com/tx/52SP9g6yqKmfmdZhUUQ4a7pst474mxGVEnR4WDtwQGdAprh3etawPudeVzdDqYgW2Fi2MxucXsbcvXi44PPeEDFR?cluster=devnet
- Created Wed Nov 11, 2026, 10:55:58 AM ET

## Step (a) — mint one Core asset with Attributes and an Update Delegate

- Funded the hot delegate with 0.05 devnet SOL from the authority: https://explorer.solana.com/tx/3fx8PDXXcNn8QCrStk8o5k3tjZQyT7P6YJqWWJeUDodQteHyZKPeQ8mfCf69vsfva6cTvmZNeBwnfU2Yu7UsoNZW?cluster=devnet
- Added a collection-level Update Delegate (`additionalDelegates` = the hot key): https://explorer.solana.com/tx/4owBsxP2YgDVyQiJXfkoYPVZEdFHxKHYbqK9ykfZ6pnotZWTXKRAGjLKDcLBXuYbsGXBnhpKAspKcauFXGmWMqYM?cluster=devnet
- Minted the asset with the Attributes plugin (all slot flags `"0"`) and an asset-level Update Delegate: https://explorer.solana.com/tx/4LMeK177bswCue5s4roPQhUKiKVVRJauPHsbn1dZiPSUk8LJ7Tfw2pMifWuf5sgkkfwMChXZnTdDhKN1j9MBNuFf?cluster=devnet
- Minted Wed Nov 11, 2026, 10:59:36 PM ET
- Record: `devnet/asset.json`

## Step (b) — flag update, RPC confirm, local composite

- `updatePlugin` via the hot Update Delegate set `door=1` and `checkins=1`: https://explorer.solana.com/tx/3TjjKzjLp1Fy4rH1mzEjYxyoaC4pCMYM7MBcZ4SBbVRUV2XDcUeqmpSW3QRWTtMT6TkdEWFRC1sCHQyx12tYYJpG?cluster=devnet
- Confirmed with `fetchAsset` on `https://api.devnet.solana.com` (state `10000`). Public devnet RPC does not speak DAS (`getAsset`); no `DAS_RPC` was set, so DAS was skipped.
- Local composite from Design’s layer pack: `devnet/renders/state_10000.png`
- Script: `devnet/update-flag.js`

## Step (c) — Private Tickets hook, dry-run, real txs, replay no-op

Hooked on a **separate branch**, local only. The live Private Tickets site was not deployed or published.

- Branch: `solana-devnet-nft` in `local Private Tickets tree (not in this repo)` (from `events`)
- Client hook: `src/lib/solanaNft.ts`, called from `runDoorCheck` (admit and already-checked-in). Runs only when `VITE_SOLANA_NFT_UPDATER` is set.
- Server hook: `netlify/lib/solanaNftHook.ts`, called from `/api/checkins` after `created: true` or `created: false`. Runs only when `SOLANA_NFT_UPDATER` is set. Failures never block admission.
- Existing function tests still pass (14/14) with the hook disabled by default.

Idempotency test (`devnet/test-checkin-idempotency.js`):

1. Reset `door=0`: https://explorer.solana.com/tx/4AMkJXJM25pYwJZfqjQ6fXrCUJe8GhPfdctVwZAFQrC2EQzv6xV4KQ7TU4zg1dEbrNneHyxbJttuKtkRbSbR3gw3?cluster=devnet
2. Dry-run first check-in: planned `door=1`, **no transaction**
3. Real first check-in `updatePlugin`: https://explorer.solana.com/tx/28d29tLusCvtJJE5zaRLet6def9NJqJAFjswQtiCe1Bn2S2NP2uZbYMuwPGyeKyLjN1KYaW6ztveQY7zKijkyYMm?cluster=devnet
4. Replayed check-in: `slot door already 1`, **no transaction**, flags unchanged

## Step (d) — Design layer pack and renderer

Design’s pack was already on the box at `a local design pack (not in this repo)` (working copy: direction C, thread weave; layers, transparent PNGs, and all 32 `state_XXXXX.png` files). No placeholders were generated.

Local renderer (not a Netlify site; existing sites were not touched):

- Start: `node devnet/renderer/serve.js`
- URL: http://127.0.0.1:8787/
- Composites Design’s pre-rendered states from on-chain flags, and exposes `POST /checkin` for the Private Tickets hook

## Step (e) — devnet demo video

- Path: `demo/solana-layered-ticket.mp4`
- Duration: 48.0 seconds, 1920×1080, H.264 + AAC
- Subtitles: `demo/solana-layered-ticket.srt` (also burned into the lower band)
- Format: phone, iPad and computer side by side, real footage of the local Private Tickets door + the renderer, English tech-creator voiceover (en-US-AndrewNeural), burned-in subtitles below the devices
- The recording’s live check-in `updatePlugin`: https://explorer.solana.com/tx/2fdaBksfK9buoQfnbbsvGYSr3EnG6mDMTy1DSh8vwUEVpbrXqGQGHtqaCciZhDoBhZp5qYaRxH1w8sCmorWhhkXL?cluster=devnet
- The replayed scan produced **no** transaction; the renderer logged `replayed check-in: no-op`

## How to re-run (devnet only)

```
cd devnet
# mint is refused if asset.json already exists
node update-flag.js --slot door --value 1
node test-checkin-idempotency.js
node renderer/serve.js   # http://127.0.0.1:8787
```

## Caveats

- Public `api.devnet.solana.com` has no DAS `getAsset`. Confirmation is an RPC `fetchAsset` read. That RPC can lag for a second or two after `sendAndConfirm`.
- The renderer and hook are local only (`127.0.0.1:8787`). The asset metadata URI is still the placeholder `https://example.com/breakpoint-ticket-1.json`.
- The Private Tickets hook lives on branch `solana-devnet-nft` and is env-gated. The live Netlify site `1e0c39b4-57aa-4fe5-b39c-fbcf1e8aac6a` and Noah project `6af36e4f0f0fdce9c2a62596` were not touched.
- The door demo was recorded without the Netlify sync API, so the door shows “Offline, will sync”. Local admit and the on-chain flag update still ran. Headless Playwright has no camera, so the door used the paste-code field.
- The phone pane still shows some of the in-app demo guide above the QR. The guest name can sit off-screen because the QR was scrolled into view.
- Extra `door=0` reset transactions were sent between the scripted test and the video so the unlock could be filmed live. `checkins` on the asset is therefore higher than 1.
- Tickets are transferable. No soulbound or freeze plugin was added, per Mark’s decision (ownership, trading, and provenance).
- Keys must never be printed, copied, or committed.

## Hosted renderer and metadata (12 Nov 2026)

New, separate Netlify site (deployed once). Existing sites were not touched.

- Site: https://breakpoint-ticket-renderer.netlify.app
- Site id: `55e394a1-a961-495b-aeb3-407e4a313704`
- Live HTML renderer: https://breakpoint-ticket-renderer.netlify.app/
- Cache-aware image (reads on-chain flags, ETag + 15s max-age, stale-while-revalidate 300s): https://breakpoint-ticket-renderer.netlify.app/render/devnet-ticket-001.png
- Metadata JSON (same cache policy, live attributes): https://breakpoint-ticket-renderer.netlify.app/metadata/devnet-ticket-001.json
- Production visitor access is public (`sso_login_context=non_production`), so wallets can fetch metadata. Non-production deploys stay team-gated. This setting was changed only on this new site.

On-chain URI update (devnet, confirmed with `fetchAsset`): https://explorer.solana.com/tx/5jVEBPm2X2etFaoPxBzBTRqkoGDFrBEtDRzVNeqarZRqSVyLnmSboBkehueu6euciNiK62Ndx7fhT9Apt7AgJs6a?cluster=devnet

Current URI: `https://breakpoint-ticket-renderer.netlify.app/metadata/devnet-ticket-001.json`

## Transfer policy

Mark decided NFT tickets are about ownership, trading, and provenance. The asset has no soulbound or freeze plugin and should stay transferable. Do not add one on mainnet unless he changes this.

Mainnet steps, costs, and approval points: `MAINNET.md`.
