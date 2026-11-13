# Check-in hook (standalone)

These two files are extracted from commit `e8b714b` on the local `solana-devnet-nft` branch. They are published here as a standalone module. The Private Tickets app itself is not in this repository.

- `solanaNft.ts` — client hook. After a door check-in, it POSTs to a local updater if `VITE_SOLANA_NFT_UPDATER` is set. Replays send `replay=true` so the updater can no-op. Failures never block the door.
- `solanaNftHook.ts` — server hook. Same idea, gated on `SOLANA_NFT_UPDATER`. A replayed check-in (`created=false`) is sent as `replay=true`. Optional `SOLANA_NFT_DRY_RUN=1`.

The updater they call is `devnet/checkin-updater.js` / `POST /checkin` on the local renderer, which runs an idempotent Metaplex Core `updatePlugin` (`door=1`) via the Update Delegate.

This hook is env-gated and was never published to the live Private Tickets site.
