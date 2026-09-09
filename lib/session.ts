export type SessionPhase = "weekend" | "preopen" | "open" | "closed";

function kolkataParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    label: `${get("day")} ${get("month")} ${get("hour")}:${get("minute")} IST`,
  };
}

export function indiaSession(now = new Date()): {
  phase: SessionPhase;
  label: string;
  clock: string;
  open: boolean;
} {
  const { weekday, hour, minute, label } = kolkataParts(now);
  const mins = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  let phase: SessionPhase = "closed";
  if (weekend) phase = "weekend";
  else if (mins >= 9 * 60 && mins < 9 * 60 + 15) phase = "preopen";
  else if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) phase = "open";
  return {
    phase,
    label,
    clock: label,
    open: phase === "open" || phase === "preopen",
  };
}

export function jwtExpiryMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function tokenAgeLabel(token: string, now = Date.now()): string | null {
  const exp = jwtExpiryMs(token);
  if (!exp) return null;
  const ms = exp - now;
  if (ms <= 0) return "token expired";
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `token ${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `token ${hours}h ${mins}m`;
}

/** Renew when the JWT is still valid but inside the last 12 hours. */
export function shouldRenewDhanToken(token: string, now = Date.now()): boolean {
  const exp = jwtExpiryMs(token);
  if (!exp) return false;
  const left = exp - now;
  return left > 0 && left <= 12 * 3_600_000;
}
