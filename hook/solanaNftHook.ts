/**
 * Optional server hook for the Solana devnet layered-ticket updater.
 * Runs only when SOLANA_NFT_UPDATER is set. A replayed check-in (created=false)
 * is sent as replay=true so the updater is a no-op. Errors are logged and
 * swallowed: the NFT is a collectible, not the door credential.
 */
export async function notifySolanaNftFromCheckin(opts: {
    ticketHash?: string;
    created: boolean;
    slot?: string;
}): Promise<void> {
    const base = process.env.SOLANA_NFT_UPDATER?.replace(/\/$/, '');
    if (!base) return;
    const dryRun = process.env.SOLANA_NFT_DRY_RUN === '1';
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        await fetch(`${base}/checkin`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ticketHash: opts.ticketHash,
                slot: opts.slot ?? 'door',
                replay: opts.created === false,
                dryRun,
            }),
            signal: ctrl.signal,
        });
        clearTimeout(timer);
    } catch (err) {
        console.error('solana nft hook failed', err);
    }
}
