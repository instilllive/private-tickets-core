# Private Tickets on Metaplex Core

Private Tickets is a Metaplex Core event pass the door will honor only for the current owner, with a host-set resale cap and royalty enforced in Core plugins, and a check-in that turns the ticket into a “was there” souvenir.

Events and the calendar stay in the app. The chain holds ownership, the cap, the royalty, provenance, and attendance. This repository is the Solana / Metaplex Core prototype. A related NEAR implementation (capped resale, host royalty, souvenir check-in) is at [instilllive/Near--private-tickets](https://github.com/instilllive/Near--private-tickets).

All on-chain work here is **Solana devnet only**. Nothing in this repo spends on mainnet.

## Devnet prototype

| | |
| --- | --- |
| Cluster | Solana devnet |
| Collection | [`Ck9qLRFXR3rdhuRk5A4XRUJzdFWyMveqranfBDhHLH4Z`](https://explorer.solana.com/address/Ck9qLRFXR3rdhuRk5A4XRUJzdFWyMveqranfBDhHLH4Z?cluster=devnet) (Breakpoint Test Tickets) |
| Asset | [`Cu4sj5yoPZjqukgBv6dnwuxGwF2w746zhWNML8RMr6rD`](https://explorer.solana.com/address/Cu4sj5yoPZjqukgBv6dnwuxGwF2w746zhWNML8RMr6rD?cluster=devnet) (Breakpoint 2026 Ticket #1) |
| Update Delegate | [`B52kMbwTdtguVKCy2RnoX9pRU4B4k9JE5VyjxasS7Das`](https://explorer.solana.com/address/B52kMbwTdtguVKCy2RnoX9pRU4B4k9JE5VyjxasS7Das?cluster=devnet) |
| Renderer | https://breakpoint-ticket-renderer.netlify.app |
| Metadata | https://breakpoint-ticket-renderer.netlify.app/metadata/devnet-ticket-001.json |
| Demo (48 seconds) | [demo/solana-layered-ticket.mp4](demo/solana-layered-ticket.mp4) |

More transaction links and a step-by-step log are in [devnet/STATUS.md](devnet/STATUS.md).

## How check-in works

The ticket is a Metaplex Core asset with the **Attributes** plugin. Flags such as `door` and `checkins` live on the asset, not in a custom program account.

A collection- and asset-level **Update Delegate** (hot key) is allowed to call `updatePlugin`. It cannot change the root update authority. A door check-in sets `door=1` (and increments `checkins`). If `door` is already `1`, the updater is a **no-op** and sends no transaction, so check-ins are idempotent.

The hosted renderer reads those on-chain flags and returns a cache-aware image and metadata JSON. A standalone, env-gated hook in [`hook/`](hook/) can notify the updater after a door scan. Failures never block admission. That hook was not published to the live Private Tickets site.

Today, tickets stay transferable. A post-check-in souvenir lock (no further resale) is planned, not built yet. See the roadmap below.

## What’s in this repo

- `devnet/` — mint, plugin, and check-in scripts and helpers (Core collection, Attributes, Update Delegate)
- `renderer-site/` — source for the hosted renderer
- `hook/` — standalone check-in hook (client and server), extracted from commit `e8b714b`
- `demo/` — 48-second demo video
- `docs/` — one-page grant deck

Secret keys, keypair files, `.env` files, and Netlify tokens are not in this repository. If you run the mint scripts, put local keypairs in `devnet/keys/` (gitignored).

## Roadmap (MetaplexDAO Grants Cohort 2)

Proposed ask: **$18,000**, paid in milestone tranches. Devnet only unless the maintainer later approves mainnet.

1. **Open-source the existing Core ticket** (~$4,000). Publish this standard: Attributes check-in, Update Delegate, renderer, event policy in AppData, and the Royalties plugin, plus docs.
2. **Capped resale and host payout** (~$5,000). Port the NEAR list/buy path to Core: listings above the host cap are rejected; a fair sale pays the seller and the host royalty; provenance is recorded; tests included.
3. **Souvenir check-in** (~$5,000). After an idempotent `door=1` check-in, the rendered badge becomes a “was there” souvenir, a returning-guest read is available, and **tickets stay transferable until check-in and lock into a souvenir afterward** (planned, not built yet). New demo video.
4. **Public-goods package** (~$4,000). TypeScript SDK, reference UI, and documentation other Core builders can reuse.

## License

MIT. See [LICENSE](LICENSE).
