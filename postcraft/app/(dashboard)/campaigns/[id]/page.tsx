"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Trash2,
} from "lucide-react";
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
  Textarea,
  statusTone,
} from "@/components/ui/primitives";
import { Modal } from "@/components/ui/interactive";
import type { Campaign, CampaignDay, IgAccount, Post, PostSurface } from "@/lib/types";

type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };

interface DayDraft {
  theme: string;
  caption_draft: string;
  best_time: string;
  surface: PostSurface;
}

const SURFACES: PostSurface[] = ["feed", "reel", "story", "carousel"];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [draft, setDraft] = useState<DayDraft>({ theme: "", caption_draft: "", best_time: "18:00", surface: "feed" });
  const [savingDay, setSavingDay] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  const [materializing, setMaterializing] = useState(false);
  const [matCount, setMatCount] = useState<number | null>(null);
  const [matError, setMatError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, aRes] = await Promise.all([fetch(`/api/campaigns/${id}`), fetch("/api/accounts")]);
      if (!cRes.ok) throw new Error("Could not load this campaign.");
      const cJson = (await cRes.json()) as { campaign: Campaign; posts: Post[] };
      setCampaign(cJson.campaign);
      setPosts(cJson.posts ?? []);
      if (aRes.ok) {
        const aJson = (await aRes.json()) as { accounts: AccountRow[] };
        setAccounts(aJson.accounts ?? []);
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountsById = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  function accountLabel(accountId: string): string {
    const a = accountsById.get(accountId);
    return a ? `@${a.username}` : "unknown";
  }

  function openDay(index: number) {
    const day = campaign?.plan?.[index];
    if (!day) return;
    setDraft({
      theme: day.theme,
      caption_draft: day.caption_draft,
      best_time: day.best_time,
      surface: day.surface,
    });
    setDayError(null);
    setEditingDay(index);
  }

  async function saveDay() {
    if (!campaign?.plan || editingDay === null || savingDay) return;
    setSavingDay(true);
    setDayError(null);
    try {
      const plan: CampaignDay[] = campaign.plan.map((d, i) => (i === editingDay ? { ...d, ...draft } : d));
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json().catch(() => ({}))) as { campaign?: Campaign; error?: string };
      if (!res.ok || !json.campaign) throw new Error(json.error ?? "Could not save the day");
      setCampaign(json.campaign);
      setEditingDay(null);
    } catch (e) {
      setDayError(e instanceof Error ? e.message : "Could not save the day");
    } finally {
      setSavingDay(false);
    }
  }

  async function materialize() {
    if (materializing) return;
    setMaterializing(true);
    setMatError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/materialize`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { posts?: Post[]; error?: string };
      if (!res.ok || !json.posts) throw new Error(json.error ?? "Could not materialize the plan");
      setMatCount(json.posts.length);
      await load();
    } catch (e) {
      setMatError(e instanceof Error ? e.message : "Could not materialize the plan");
    } finally {
      setMaterializing(false);
    }
  }

  async function deleteCampaign() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete the campaign");
      router.push("/campaigns");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (loadError || !campaign) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Could not load this campaign"
        description={loadError ?? "It may have been deleted."}
        action={
          <Link href="/campaigns">
            <Button variant="outline">
              Back to campaigns
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
    );
  }

  const plan = campaign.plan ?? [];
  const editDay = editingDay !== null ? plan[editingDay] : null;

  return (
    <div>
      <PageHeader
        overline="Campaign"
        title={campaign.name}
        description={campaign.goal}
        actions={
          <>
            <Badge tone={statusTone(campaign.status)} className="capitalize">
              {campaign.status}
            </Badge>
            <Button
              variant="accent"
              disabled={materializing || plan.length === 0}
              onClick={materialize}
            >
              {materializing ? <Spinner className="w-3.5 h-3.5" /> : <Layers size={15} />}
              Materialize into drafts
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
              Delete
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        {matCount !== null ? (
          <Card className="px-5 py-4 flex flex-wrap items-center gap-3 animate-rise">
            <CheckCircle2 size={16} className="text-lime shrink-0" />
            <div className="text-sm text-paper-dim flex-1 min-w-48">
              Created {matCount} draft post{matCount === 1 ? "" : "s"} — attach designs and fine-tune
              timing in the calendar.
            </div>
            <Link href="/calendar">
              <Button size="sm" variant="outline">
                Open calendar
                <ArrowRight size={13} />
              </Button>
            </Link>
          </Card>
        ) : null}
        {matError ? (
          <Card className="px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={16} className="text-danger shrink-0" />
            <div className="text-sm text-danger/90">{matError}</div>
          </Card>
        ) : null}

        {/* Storyboard */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="microlabel">Storyboard</div>
            <div className="text-xs text-muted">
              {plan.length} day{plan.length === 1 ? "" : "s"} · {campaign.account_ids.length} account
              {campaign.account_ids.length === 1 ? "" : "s"} · starts{" "}
              {format(parseISO(campaign.start_date), "MMM d")}
            </div>
          </div>
          {plan.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="No plan on this campaign"
              description="The planning step did not produce a day-by-day arc. Delete this campaign and create it again."
              action={
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} />
                  Delete campaign
                </Button>
              }
            />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3 animate-rise">
              {plan.map((day, i) => (
                <button key={day.day} onClick={() => openDay(i)} className="text-left shrink-0 w-72">
                  <Card hover className="p-5 h-full flex flex-col gap-3 cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <span className="microlabel">
                        Day {day.day} · {format(parseISO(day.date), "EEE, MMM d")}
                      </span>
                      <Badge tone="neutral" className="capitalize shrink-0">
                        {day.surface}
                      </Badge>
                    </div>
                    <div className="display text-lg text-paper leading-snug">{day.theme}</div>
                    <p className="text-xs text-paper-dim leading-relaxed line-clamp-3">
                      {day.design_direction}
                    </p>
                    <p className="text-xs text-muted italic leading-relaxed line-clamp-3">
                      &ldquo;{day.caption_draft}&rdquo;
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-paper-dim stat-number">
                        <Clock size={12} />
                        {day.best_time}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Pencil size={11} />
                        edit
                      </span>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Linked posts */}
        <section>
          <div className="microlabel mb-3">Linked posts</div>
          {posts.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="No posts yet"
              description="Materialize the storyboard to create one draft post per day per account — then attach designs and schedule them."
              action={
                <Button variant="accent" size="sm" disabled={materializing || plan.length === 0} onClick={materialize}>
                  {materializing ? <Spinner className="w-3 h-3" /> : <Layers size={14} />}
                  Materialize into drafts
                </Button>
              }
            />
          ) : (
            <Card className="divide-y divide-line overflow-hidden animate-rise">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center gap-4 px-5 py-3.5 min-w-0">
                  <div className="w-28 shrink-0">
                    <div className="text-sm text-paper stat-number">
                      {post.scheduled_at ? format(new Date(post.scheduled_at), "HH:mm") : "—"}
                    </div>
                    <div className="text-[11px] text-muted">
                      {post.scheduled_at ? format(new Date(post.scheduled_at), "EEE, MMM d") : "unscheduled"}
                    </div>
                  </div>
                  <div className="w-32 shrink-0 text-xs text-paper-dim truncate">
                    {accountLabel(post.account_id)}
                  </div>
                  <Badge tone="neutral" className="shrink-0 capitalize">
                    {post.surface}
                  </Badge>
                  <div className="flex-1 min-w-0 text-sm text-paper-dim truncate">
                    {post.caption ? post.caption.split("\n")[0] : "(no caption yet)"}
                  </div>
                  <Badge tone={statusTone(post.status)} className="shrink-0 capitalize">
                    {post.status}
                  </Badge>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      {/* Edit-day modal */}
      <Modal
        open={editingDay !== null}
        onClose={() => {
          if (!savingDay) setEditingDay(null);
        }}
        title={editDay ? `Day ${editDay.day} — ${format(parseISO(editDay.date), "EEE, MMM d")}` : undefined}
      >
        <div className="flex flex-col gap-4">
          <Field label="Theme">
            <Input value={draft.theme} onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Surface">
              <Select
                value={draft.surface}
                onChange={(e) => setDraft((d) => ({ ...d, surface: e.target.value as PostSurface }))}
              >
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Best time">
              <Input
                type="time"
                value={draft.best_time}
                onChange={(e) => setDraft((d) => ({ ...d, best_time: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Caption draft">
            <Textarea
              value={draft.caption_draft}
              onChange={(e) => setDraft((d) => ({ ...d, caption_draft: e.target.value }))}
              className="min-h-32"
            />
          </Field>
          {dayError ? <div className="text-sm text-danger">{dayError}</div> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditingDay(null)} disabled={savingDay}>
              Cancel
            </Button>
            <Button variant="accent" onClick={saveDay} disabled={savingDay}>
              {savingDay ? <Spinner className="w-3.5 h-3.5" /> : <CheckCircle2 size={15} />}
              Save day
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        title="Delete campaign?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-paper-dim">
            This removes <span className="text-paper">{campaign.name}</span> and its storyboard
            permanently. Posts already materialized stay on the calendar.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteCampaign} disabled={deleting}>
              {deleting ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={14} />}
              Delete campaign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
