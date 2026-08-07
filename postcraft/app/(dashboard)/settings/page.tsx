"use client";

import { useEffect, useState } from "react";
import { Copy, LogOut } from "lucide-react";
import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

interface Status {
  providers: { openai: boolean; anthropic: boolean; replicate: boolean; higgsfield: boolean };
  meta_app: boolean;
  cron: boolean;
  encryption: boolean;
  app_url: string | null;
}

const PROVIDER_ROWS: Array<{
  key: keyof Status["providers"];
  name: string;
  env: string;
  blurb: string;
}> = [
  {
    key: "anthropic",
    name: "Claude (Anthropic)",
    env: "ANTHROPIC_API_KEY",
    blurb: "Captions, campaign plans, and art-directed design variants.",
  },
  {
    key: "openai",
    name: "OpenAI images",
    env: "OPENAI_API_KEY",
    blurb: "gpt-image-1 photo restyling — studio, lifestyle, and color-block edits.",
  },
  {
    key: "replicate",
    name: "Replicate (FLUX Kontext)",
    env: "REPLICATE_API_TOKEN",
    blurb: "Cinematic and minimal restyles at native 4:5 and 9:16.",
  },
  {
    key: "higgsfield",
    name: "Higgsfield (Soul)",
    env: "HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET",
    blurb: "Premium fashion-editorial looks. Requires gated Cloud API access.",
  },
];

function ConfiguredBadge({ on }: { on: boolean }) {
  return on ? <Badge tone="lime">Configured</Badge> : <Badge>Not configured</Badge>;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/settings/status");
      if (res.ok) setStatus((await res.json()) as Status);
    })();
  }, []);

  const redirectUri = `${status?.app_url ?? "https://YOUR-DOMAIN"}/api/meta/oauth/callback`;

  const copyUri = async () => {
    await navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    location.href = "/login";
  };

  if (!status) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        overline="Machine room"
        title="Settings"
        description="Environment status — configuration lives in your Vercel env vars, never in the database."
        actions={
          <Button variant="ghost" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </Button>
        }
      />

      <div className="flex flex-col gap-6 max-w-3xl">
        <Card className="p-6">
          <div className="microlabel mb-4">AI design providers</div>
          <div className="flex flex-col divide-y divide-line">
            {PROVIDER_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-paper">{row.name}</div>
                  <div className="text-xs text-muted mt-0.5">{row.blurb}</div>
                  <code className="text-[11px] text-paper-dim bg-ink-3 rounded px-1.5 py-0.5 mt-1.5 inline-block">
                    {row.env}
                  </code>
                </div>
                <ConfiguredBadge on={status.providers[row.key]} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">
            The built-in template engine needs no keys — 8 designed layouts always render.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="microlabel">Instagram connection</div>
            <ConfiguredBadge on={status.meta_app} />
          </div>
          <p className="text-sm text-paper-dim">
            Meta app credentials: <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">META_APP_ID</code>{" "}
            + <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">META_APP_SECRET</code>. Add this OAuth
            redirect URI in your Meta app&apos;s Instagram Business Login settings:
          </p>
          <div className="flex items-center gap-2 mt-3">
            <code className="text-xs text-paper bg-ink-3 border border-line rounded-lg px-3 py-2 flex-1 overflow-x-auto whitespace-nowrap">
              {redirectUri}
            </code>
            <Button variant="outline" size="sm" onClick={copyUri}>
              <Copy size={13} /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="microlabel">Scheduling</div>
            <ConfiguredBadge on={status.cron} />
          </div>
          <p className="text-sm text-paper-dim">
            Vercel Cron hits <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">/api/cron/dispatch</code>{" "}
            every minute — publishing due posts, refreshing tokens, syncing giveaway entries, and snapshotting
            insights. Per-minute cron needs the Vercel Pro plan; on Hobby it fires once a day. Guarded by{" "}
            <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">CRON_SECRET</code>.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="microlabel">Security</div>
            <ConfiguredBadge on={status.encryption} />
          </div>
          <p className="text-sm text-paper-dim">
            Instagram access tokens are AES-256-GCM encrypted at rest with{" "}
            <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">TOKEN_ENCRYPTION_KEY</code> (64 hex
            chars — <code className="text-[11px] bg-ink-3 rounded px-1.5 py-0.5">openssl rand -hex 32</code>).
            Postcraft uses only the official Instagram Platform API: no scraping, no private APIs, no automated
            follows.
          </p>
        </Card>
      </div>
    </div>
  );
}
