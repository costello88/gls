"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { AlertTriangle, Gift, Plus, RefreshCw, Timer, Trophy } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  statusTone,
} from "@/components/ui/primitives";
import { Modal, Tabs, Toggle } from "@/components/ui/interactive";
import { rulesBlurb } from "@/lib/giveaways/verify";
import { cn } from "@/lib/utils";
import type { Giveaway, GiveawayRequirements, IgAccount, Post } from "@/lib/types";

type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };
type GiveawayRow = Giveaway & { entry_count: number; eligible_count: number };
type MediaSource = "post" | "manual";

function countdown(endsAt: string): { label: string; ended: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { label: "ended", ended: true };
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return { label: `ends in ${d}d ${h}h`, ended: false };
  if (h > 0) return { label: `ends in ${h}h ${m}m`, ended: false };
  return { label: `ends in ${m}m`, ended: false };
}

export default function GiveawaysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [giveaways, setGiveaways] = useState<GiveawayRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  // New-giveaway modal
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<MediaSource>("post");
  const [publishedPosts, setPublishedPosts] = useState<Post[] | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [manualMediaId, setManualMediaId] = useState("");
  const [manualAccountId, setManualAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [endsAt, setEndsAt] = useState(() => format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
  const [winnerCount, setWinnerCount] = useState(1);
  const [mustFollow, setMustFollow] = useState(true);
  const [mustLike, setMustLike] = useState(true);
  const [mentionCount, setMentionCount] = useState(2);
  const [keyword, setKeyword] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gRes, aRes] = await Promise.all([fetch("/api/giveaways"), fetch("/api/accounts")]);
        if (!gRes.ok || !aRes.ok) throw new Error("Could not load giveaways. Refresh to try again.");
        const gJson = (await gRes.json()) as { giveaways: GiveawayRow[] };
        const aJson = (await aRes.json()) as { accounts: AccountRow[] };
        if (cancelled) return;
        setGiveaways(gJson.giveaways ?? []);
        setAccounts(aJson.accounts ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazily load published posts the first time the modal opens.
  useEffect(() => {
    if (!open || publishedPosts !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/posts?status=published");
        const json = res.ok ? ((await res.json()) as { posts: Post[] }) : { posts: [] };
        if (!cancelled) setPublishedPosts(json.posts ?? []);
      } catch {
        if (!cancelled) setPublishedPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, publishedPosts]);

  const accountsById = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  function accountLabel(accountId: string): string {
    const a = accountsById.get(accountId);
    return a ? `@${a.username}` : "unknown";
  }

  const selectedPost = useMemo(
    () => publishedPosts?.find((p) => p.id === selectedPostId) ?? null,
    [publishedPosts, selectedPostId],
  );

  const requirements: GiveawayRequirements = useMemo(
    () => ({
      must_follow: mustFollow,
      must_like: mustLike,
      mention_count: mentionCount,
      keyword: keyword.trim() || null,
      hashtag: hashtag.trim() || null,
    }),
    [mustFollow, mustLike, mentionCount, keyword, hashtag],
  );

  const rulesPreview = useMemo(() => {
    const end = endsAt ? new Date(endsAt) : new Date();
    return rulesBlurb(requirements, prize.trim() || "the prize", Number.isNaN(end.getTime()) ? new Date() : end);
  }, [requirements, prize, endsAt]);

  const canSubmit =
    title.trim().length > 0 &&
    prize.trim().length > 0 &&
    endsAt.length > 0 &&
    winnerCount >= 1 &&
    (source === "post" ? selectedPost !== null : manualMediaId.trim().length > 0 && manualAccountId.length > 0);

  async function createGiveaway() {
    if (!canSubmit || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        account_id: source === "post" ? selectedPost?.account_id : manualAccountId,
        title: title.trim(),
        prize: prize.trim(),
        ends_at: new Date(endsAt).toISOString(),
        winner_count: winnerCount,
        requirements,
      };
      if (source === "post") body.post_id = selectedPost?.id;
      else body.ig_media_id = manualMediaId.trim();

      const res = await fetch("/api/giveaways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { giveaway?: Giveaway; error?: string };
      if (!res.ok || !json.giveaway) throw new Error(json.error ?? "Could not create the giveaway");
      router.push(`/giveaways/${json.giveaway.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the giveaway");
      setCreating(false);
    }
  }

  const newButton = (
    <Button variant="accent" onClick={() => setOpen(true)}>
      <Plus size={16} />
      New giveaway
    </Button>
  );

  return (
    <div>
      <PageHeader
        overline="Postcraft · Growth"
        title="Giveaways"
        description="Run comment-to-enter giveaways on any published post — entries sync from real comments, winners are drawn with a verifiable seed."
        actions={newButton}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-6 h-6" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Could not load giveaways"
          description={loadError}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw size={14} />
              Reload
            </Button>
          }
        />
      ) : giveaways.length === 0 ? (
        <EmptyState
          icon={<Gift />}
          title="Run your first giveaway"
          description="Pick a published post, set the prize and the entry rules — Postcraft pulls the comments, checks each entry, and draws winners fairly."
          action={newButton}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 animate-rise">
          {giveaways.map((g) => {
            const cd = countdown(g.ends_at);
            return (
              <Link key={g.id} href={`/giveaways/${g.id}`} className="block">
                <Card hover className="p-5 h-full flex flex-col gap-3 cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="display text-xl text-paper leading-snug">{g.title}</div>
                    <Badge tone={statusTone(g.status)} className="capitalize shrink-0">
                      {g.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-paper-dim inline-flex items-center gap-1.5">
                    <Gift size={14} className="text-accent shrink-0" />
                    <span className="truncate">{g.prize}</span>
                  </div>
                  <div className="text-xs text-muted">{accountLabel(g.account_id)}</div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs">
                    <span className="text-paper-dim">
                      <span className="stat-number text-paper">{g.entry_count}</span> entries ·{" "}
                      <span className="stat-number text-paper">{g.eligible_count}</span> eligible
                    </span>
                    {g.status === "drawn" ? (
                      <span className="inline-flex items-center gap-1 text-warn">
                        <Trophy size={12} />
                        drawn
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          cd.ended ? "text-muted" : "text-accent",
                        )}
                      >
                        <Timer size={12} />
                        {cd.label}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!creating) setOpen(false);
        }}
        title="New giveaway"
        wide
      >
        <div className="flex flex-col gap-5">
          {/* Media source */}
          <div className="flex flex-col gap-3">
            <span className="microlabel">Giveaway post</span>
            <Tabs<MediaSource>
              value={source}
              onChange={setSource}
              options={[
                { value: "post", label: "From a published post" },
                { value: "manual", label: "Manual media ID" },
              ]}
            />
            {source === "post" ? (
              publishedPosts === null ? (
                <div className="flex items-center gap-2 text-sm text-paper-dim py-3">
                  <Spinner /> Loading published posts…
                </div>
              ) : publishedPosts.length === 0 ? (
                <div className="text-sm text-paper-dim py-2">
                  No published posts yet — publish something first, or switch to a manual media ID.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {publishedPosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPostId(p.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg border transition-colors cursor-pointer",
                        selectedPostId === p.id
                          ? "border-accent bg-accent-soft"
                          : "border-line bg-ink-3 hover:border-line-2",
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-paper font-medium">{accountLabel(p.account_id)}</span>
                        <Badge tone="neutral" className="capitalize">
                          {p.surface}
                        </Badge>
                        {p.published_at ? (
                          <span className="text-muted">{format(new Date(p.published_at), "MMM d")}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-paper-dim truncate mt-1">
                        {p.caption ? p.caption.split("\n")[0] : "(no caption)"}
                      </div>
                      {p.ig_permalink ? (
                        <div className="text-[11px] text-muted truncate mt-0.5">{p.ig_permalink}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account">
                  <Select value={manualAccountId} onChange={(e) => setManualAccountId(e.target.value)}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.username}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Instagram media ID" hint="The IG media object ID whose comments count as entries.">
                  <Input
                    value={manualMediaId}
                    onChange={(e) => setManualMediaId(e.target.value)}
                    placeholder="17895695668004550"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Basics */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer bundle giveaway" />
            </Field>
            <Field label="Prize">
              <Input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="A full ceramics starter set" />
            </Field>
            <Field label="Ends at">
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
            <Field label="Winners">
              <Input
                type="number"
                min={1}
                value={winnerCount}
                onChange={(e) => setWinnerCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          </div>

          {/* Requirements */}
          <div className="flex flex-col gap-3">
            <span className="microlabel">Entry requirements</span>
            <Toggle
              checked={mustFollow}
              onChange={setMustFollow}
              label="Must follow the account (honor system, not API-verifiable)"
            />
            <Toggle
              checked={mustLike}
              onChange={setMustLike}
              label="Must like the post (honor system, not API-verifiable)"
            />
            <div className="grid grid-cols-3 gap-4 mt-1">
              <Field label="Friends to tag" hint="0 disables the rule">
                <Input
                  type="number"
                  min={0}
                  value={mentionCount}
                  onChange={(e) => setMentionCount(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Keyword">
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="WIN" />
              </Field>
              <Field label="Hashtag">
                <Input value={hashtag} onChange={(e) => setHashtag(e.target.value)} placeholder="#postcraft" />
              </Field>
            </div>
          </div>

          {/* Rules preview */}
          <div>
            <div className="microlabel mb-1.5">Rules preview</div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-paper-dim bg-ink-3 border border-line rounded-lg p-4 leading-relaxed">
              {rulesPreview}
            </pre>
          </div>

          {formError ? <div className="text-sm text-danger">{formError}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!canSubmit || creating} onClick={createGiveaway}>
              {creating ? <Spinner className="w-3.5 h-3.5" /> : <Gift size={15} />}
              Launch giveaway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
