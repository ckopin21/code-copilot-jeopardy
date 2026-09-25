export type ClientRecoveryReason = 'pageshow' | 'visibility' | 'online';

export const CLIENT_BACKGROUND_REFRESH_MS = 5000;
export const HEARTBEAT_FAILURES_BEFORE_REFRESH = 2;

export function shouldForceClientTransportReset(
  reason: ClientRecoveryReason,
  options: { persisted?: boolean; hiddenForMs?: number } = {}
): boolean {
  if (reason === 'online') return true;
  if (reason === 'pageshow') return Boolean(options.persisted);
  return Math.max(0, options.hiddenForMs ?? 0) >= CLIENT_BACKGROUND_REFRESH_MS;
}


export function shouldRefreshAfterHeartbeatFailures(consecutiveFailures: number): boolean {
  return Math.max(0, consecutiveFailures) >= HEARTBEAT_FAILURES_BEFORE_REFRESH;
}
