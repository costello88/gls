"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, ArrowRight, CalendarRange, Megaphone, Plus, RefreshCw, Users } from "lucide-react";
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
import { Modal, SegmentedMulti } from "@/components/ui/interactive";
import type { Campaign, IgAccount } from "@/lib/types";

type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };

const DAY_OPTIONS = ["5", "7", "10", "14"];

export default function CampaignsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  // New-campaign modal
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [startDate, setStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [days, setDays] = useState("7");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, aRes] = await Promise.all([fetch("/api/campaigns"), fetch("/api/accounts")]);
        if (!cRes.ok || !aRes.ok) throw new Error("Could not load campaigns. Refresh to try again.");
        const cJson = (await cRes.json()) as { campaigns: Campaign[] };
        const aJson = (await aRes.json()) as { accounts: AccountRow[] };
        if (cancelled) return;
        setCampaigns(cJson.campaigns ?? []);
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

  const canSubmit =
    name.trim().length > 0 &&
    goal.trim().length > 0 &&
    brief.trim().length > 0 &&
    startDate.length > 0 &&
    accountIds.length > 0;

  async function createCampaign() {
    if (!canSubmit || pending) return;
    setPending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          goal: goal.trim(),
          brief: brief.trim(),
          start_date: startDate,
          days: Number(days),
          account_ids: accountIds,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { campaign?: Campaign; error?: string };
      if (!res.ok || !json.campaign) throw new Error(json.error ?? "Could not plan the campaign");
      router.push(`/campaigns/${json.campaign.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not plan the campaign");
      setPending(false);
    }
  }

  const newButton = (
    <Button variant="accent" onClick={() => setOpen(true)}>
      <Plus size={16} />
      New campaign
    </Button>
  );

  return (
    <div>
      <PageHeader
        overline="Postcraft · Planner"
        title="Campaigns"
        description="Claude drafts a multi-day content arc — themes, design directions, captions and timing — then one click turns it into drafts."
        actions={newButton}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-6 h-6" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Could not load campaigns"
          description={loadError}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw size={14} />
              Reload
            </Button>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No campaigns yet"
          description="Give Claude a goal and a brief — it plans a full arc (teaser, launch, social proof, urgency, recap) day by day, ready to materialize into scheduled drafts."
          action={newButton}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 animate-rise">
          {campaigns.map((c) => {
            const start = parseISO(c.start_date);
            const end = addDays(start, Math.max(c.days - 1, 0));
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="block">
                <Card hover className="p-5 h-full flex flex-col gap-3 cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="display text-xl text-paper leading-snug">{c.name}</div>
                    <Badge tone={statusTone(c.status)} className="capitalize shrink-0">
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-paper-dim line-clamp-2">{c.goal}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarRange size={13} />
                      {format(start, "MMM d")} – {format(end, "MMM d")}
                    </span>
                    <span>·</span>
                    <span>{c.plan?.length ?? c.days} days</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {c.account_ids.length} account{c.account_ids.length === 1 ? "" : "s"}
                    </span>
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
          if (!pending) setOpen(false);
        }}
        title={pending ? undefined : "New campaign"}
        wide
      >
        {pending ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Spinner className="w-6 h-6" />
            <div className="display text-lg text-paper mt-5">Claude is planning your campaign…</div>
            <p className="text-sm text-paper-dim mt-2 max-w-sm">
              Drafting a {days}-day arc — themes, design directions, caption drafts and best posting
              times. This can take around 30 seconds.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spring drop launch"
                autoFocus
              />
            </Field>
            <Field label="Goal">
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Launch the new collection and drive 500 pre-orders"
              />
            </Field>
            <Field
              label="Brief"
              hint="Product, audience, angle, offers — everything Claude should build the arc around."
            >
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="We sell handmade ceramic mugs. New spring glaze collection drops on the 15th…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Length">
                <Select value={days} onChange={(e) => setDays(e.target.value)}>
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="microlabel">Accounts</span>
              {accounts.length === 0 ? (
                <div className="text-sm text-paper-dim">
                  No accounts connected yet —{" "}
                  <Link href="/accounts" className="text-accent hover:underline">
                    connect one first
                  </Link>
                  .
                </div>
              ) : (
                <SegmentedMulti
                  values={accountIds}
                  onChange={setAccountIds}
                  options={accounts.map((a) => ({ value: a.id, label: `@${a.username}` }))}
                />
              )}
            </div>
            {formError ? <div className="text-sm text-danger">{formError}</div> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="accent" disabled={!canSubmit} onClick={createCampaign}>
                <Megaphone size={15} />
                Plan campaign
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
