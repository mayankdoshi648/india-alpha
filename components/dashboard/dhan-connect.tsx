"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { DhanCredentials } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/dashboard/primitives";
import { KeyRound, LoaderCircle, PlugZap, Unplug } from "lucide-react";

const EMPTY: DhanCredentials = { accessToken: "", clientId: "" };

export function DhanConnect({
  stored,
  liveConnected,
  busy,
  status,
  error,
  compact = false,
  onConnect,
  onDisconnect,
}: {
  stored: DhanCredentials;
  liveConnected: boolean;
  busy: boolean;
  status: string | null;
  error: string | null;
  compact?: boolean;
  onConnect: (creds: DhanCredentials) => Promise<void>;
  onDisconnect: () => void;
}) {
  const [draft, setDraft] = useState<DhanCredentials>(stored.accessToken ? stored : EMPTY);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    setDraft(stored.accessToken ? stored : EMPTY);
  }, [stored.accessToken, stored.clientId]);

  const savedHere = Boolean(stored.accessToken && stored.clientId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onConnect({
      accessToken: draft.accessToken.trim(),
      clientId: draft.clientId.trim(),
    });
  }

  return (
    <Panel className={compact ? "space-y-3" : undefined} glow={liveConnected ? "up" : "none"}>
      <form id={compact ? "dhan-connect-compact" : "dhan-connect"} className="space-y-3" onSubmit={submit}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">
            <KeyRound className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.18em] text-cyan-400/80 uppercase">DhanHQ</p>
            <h2 className="text-base font-medium">Connect live quotes on this page</h2>
            <p className="text-sm text-muted-foreground">
              Paste the 24-hour JWT from web.dhan.co → My Profile → Access DhanHQ APIs. Client ID is optional — we read it from the token. Do not paste the API key.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Access token</span>
            <Input
              id={compact ? "dhan-access-token-compact" : "dhan-access-token"}
              type={showToken ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="JWT access token (starts with eyJ)"
              value={draft.accessToken}
              onChange={(e) => setDraft((d) => ({ ...d, accessToken: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Client ID</span>
            <Input
              id={compact ? "dhan-client-id-compact" : "dhan-client-id"}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Numeric Client ID (optional)"
              value={draft.clientId}
              onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            id={compact ? "dhan-save-compact" : "dhan-save"}
            type="submit"
            size="sm"
            disabled={busy || !draft.accessToken.trim()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <PlugZap />}
            {liveConnected ? "Reconnect" : "Connect Dhan"}
          </Button>
          {savedHere ? (
            <Button
              id={compact ? "dhan-disconnect-compact" : "dhan-disconnect"}
              type="button"
              size="sm"
              variant="outline"
              onClick={onDisconnect}
              disabled={busy}
            >
              <Unplug />
              Disconnect
            </Button>
          ) : null}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-cyan-400"
              checked={showToken}
              onChange={(e) => setShowToken(e.target.checked)}
            />
            Show token
          </label>
        </div>

        <p
          className={
            error
              ? "text-sm text-rose-300"
              : liveConnected
                ? "text-sm text-emerald-300"
                : "text-sm text-muted-foreground"
          }
        >
          {error
            ? error
            : status
              ? status
              : liveConnected
                ? "Dhan is connected. Quotes, candles and the Nifty option chain use this account."
                : savedHere
                  ? "Keys are saved in this browser. Connect to verify them against Dhan."
                  : "Without Dhan, the desk uses NSE when reachable, otherwise the local 8 Sep 2026 tape. Tokens last 24 hours."}
        </p>
      </form>
    </Panel>
  );
}
