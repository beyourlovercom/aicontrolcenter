const FALLBACK = '时间不可用';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Formats persisted UTC ISO timestamps for the Owner's local browser timezone. */
export function formatOwnerLocalTime(timestamp?: string | null): string {
  if (!timestamp) return FALLBACK;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return FALLBACK;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const OWNER_TIME_FALLBACK = FALLBACK;
