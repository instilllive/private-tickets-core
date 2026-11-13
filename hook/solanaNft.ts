/**
 * Optional hook: after a Private Tickets check-in, notify a local Solana devnet
 * updater so the layered-ticket collectible can flip a flag. Disabled unless
 * VITE_SOLANA_NFT_UPDATER is set. A replay (already checked in) is reported
 * as replay=true so the updater can no-op. Failures never block the door.
 */
const updaterUrl = (): string | undefined => {
    try {
        const url = import.meta.env.VITE_SOLANA_NFT_UPDATER;
        return typeof url === 'string' && url.startsWith('http') ? url.replace(/\/$/, '') : undefined;
    } catch {
        return undefined;
    }
};

export function notifySolanaNft(opts: { ticketId: string; slot?: string; replay?: boolean }): void {
    const base = updaterUrl();
    if (!base) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch(`${base}/checkin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            ticketId: opts.ticketId,
            slot: opts.slot ?? 'door',
            replay: opts.replay === true,
        }),
        signal: ctrl.signal,
    })
        .catch(() => undefined)
        .finally(() => clearTimeout(timer));
}
