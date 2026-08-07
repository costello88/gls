"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AtSign, Plus, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  statusTone,
} from "@/components/ui/primitives";
import { formatCompact, timeAgo } from "@/lib/utils";
import type { IgAccount } from "@/lib/types";

type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };

function ConnectBanner() {
  const params = useSearchParams();
  const connected = params.get("connected");
  const error = params.get("error");
  if (!connected && !error) return null;
  return (
    <div
      className={`card p-4 mb-6 text-sm ${error ? "border-danger/40 text-danger" : "border-lime/40 text-lime"}`}
    >
      {error ? `Connection failed: ${error}` : `Connected @${connected} — you're ready to publish.`}
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounts");
    if (res.ok) {
      const body = (await res.json()) as { accounts: AccountRow[] };
      setAccounts(body.accounts);
    } else {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    await fetch("/api/accounts/sync", { method: "POST" });
    await load();
    setSyncing(false);
  };

  const disconnect = async (id: string, username: string) => {
    if (!confirm(`Disconnect @${username}? Scheduled posts for this account will fail.`)) return;
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <PageHeader
        overline="Connections"
        title="Accounts"
        description="Instagram professional accounts this machine publishes to."
        actions={
          <>
            <Button variant="outline" onClick={sync} disabled={syncing || !accounts?.length}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync profiles
            </Button>
            <Button variant="accent" onClick={() => (location.href = "/api/meta/oauth/start")}>
              <Plus size={14} /> Connect Instagram
            </Button>
          </>
        }
      />

      <Suspense>
        <ConnectBanner />
      </Suspense>

      {accounts === null ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<AtSign />}
          title="No accounts connected"
          description="Connect an Instagram professional account (Business or Creator). You'll need a Meta app with the Instagram Login product — see Settings for the exact setup."
          action={
            <div className="flex gap-2">
              <Button variant="accent" onClick={() => (location.href = "/api/meta/oauth/start")}>
                Connect Instagram
              </Button>
              <Link href="/settings">
                <Button variant="outline">Setup guide</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <Card key={a.id} hover className="p-5">
              <div className="flex items-start gap-4">
                <div className="ig-ring rounded-full p-[2.5px] shrink-0">
                  <div className="bg-ink rounded-full p-[2.5px]">
                    {a.profile_picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.profile_picture_url}
                        alt={a.username}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-ink-3 flex items-center justify-center text-paper-dim display text-xl">
                        {a.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="display text-lg text-paper truncate">@{a.username}</span>
                    <Badge tone={statusTone(a.status)}>{a.status.replace("_", " ")}</Badge>
                  </div>
                  {a.name ? <div className="text-xs text-paper-dim mt-0.5">{a.name}</div> : null}
                  <div className="flex gap-5 mt-3">
                    <div>
                      <div className="stat-number text-xl text-paper">{formatCompact(a.followers_count)}</div>
                      <div className="microlabel">Followers</div>
                    </div>
                    <div>
                      <div className="stat-number text-xl text-paper">{formatCompact(a.media_count)}</div>
                      <div className="microlabel">Posts</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
                <span
                  className={`text-xs ${
                    a.token_days_left !== null && a.token_days_left < 10 ? "text-warn" : "text-muted"
                  }`}
                >
                  {a.token_days_left !== null
                    ? `Token: ${a.token_days_left}d left (auto-refreshes)`
                    : "Token: unknown"}
                  {a.last_synced_at ? ` · synced ${timeAgo(a.last_synced_at)}` : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => disconnect(a.id, a.username)}>
                  Disconnect
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-6 mt-8">
        <div className="microlabel mb-4">How connection works</div>
        <ol className="grid md:grid-cols-3 gap-6 text-sm text-paper-dim">
          <li className="flex gap-3">
            <span className="stat-number text-2xl text-accent shrink-0">1</span>
            <span>
              Create a <span className="text-paper">Meta app</span> (type Business) at
              developers.facebook.com and add the Instagram product with{" "}
              <span className="text-paper">Instagram Login</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="stat-number text-2xl text-accent shrink-0">2</span>
            <span>
              Add the redirect URI shown in <Link href="/settings" className="text-accent">Settings</Link> and put
              the app ID + secret in your environment variables.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="stat-number text-2xl text-accent shrink-0">3</span>
            <span>
              Hit <span className="text-paper">Connect Instagram</span> and sign in with a professional
              (Business/Creator) account. Personal accounts can&apos;t use the publishing API.
            </span>
          </li>
        </ol>
      </Card>
    </div>
  );
}
