"use client";

/**
 * The Create wizard — Postcraft's core machine.
 * Upload → Designs → Copy → Destinations → Timing → Review → Launch.
 * All state lives here; nothing is persisted across reloads.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  CheckCircle2,
  ExternalLink,
  Film,
  Images,
  RefreshCw,
  Rocket,
  UploadCloud,
  X,
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
  type BadgeTone,
} from "@/components/ui/primitives";
import { SegmentedMulti, Tabs, Toggle } from "@/components/ui/interactive";
import { cn, formatCompact } from "@/lib/utils";
import type { Asset, CaptionSet, Design, DesignProvider, IgAccount, Post, PostSurface } from "@/lib/types";
import { Stepper } from "./stepper";
import { IgPreview } from "./ig-preview";

/* ------------------------------------------------------------------ types */

type ClientAccount = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };
type Tone = "confident" | "playful" | "minimal" | "storyteller" | "salesy";
type TimingMode = "now" | "schedule";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "designs", label: "Designs" },
  { id: "copy", label: "Copy" },
  { id: "destinations", label: "Destinations" },
  { id: "timing", label: "Timing" },
  { id: "review", label: "Review" },
] as const;

const TONES: Array<{ value: Tone; label: string }> = [
  { value: "confident", label: "Confident" },
  { value: "playful", label: "Playful" },
  { value: "minimal", label: "Minimal" },
  { value: "storyteller", label: "Storyteller" },
  { value: "salesy", label: "Salesy" },
];

const PROVIDER_TONES: Record<DesignProvider, BadgeTone> = {
  template: "neutral",
  openai: "paper",
  anthropic: "accent",
  higgsfield: "lime",
  replicate: "warn",
};

/* ---------------------------------------------------------------- helpers */

async function api<T>(
  input: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(input, init);
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || data === null) {
      return { ok: false, error: data?.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return api<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function slotAt(daysAhead: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function slotLabel(d: Date): string {
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${String(d.getHours()).padStart(2, "0")}:00`;
}

/* --------------------------------------------------------- small pieces */

function StepHeading({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="mb-5 animate-rise">
      <div className="microlabel mb-1.5">
        Step {String(index + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
      </div>
      <h2 className="display text-2xl text-paper">{title}</h2>
      {hint ? <p className="text-sm text-paper-dim mt-1 max-w-2xl">{hint}</p> : null}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  busy = false,
  busyLabel,
  accent = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-line">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </Button>
      ) : (
        <span />
      )}
      <Button variant={accent ? "accent" : "primary"} size={accent ? "lg" : "md"} onClick={onNext} disabled={nextDisabled || busy}>
        {busy ? (
          <>
            <Spinner /> {busyLabel ?? nextLabel}
          </>
        ) : (
          <>
            {accent ? <Rocket size={15} /> : null}
            {nextLabel}
            {accent ? null : <ArrowRight size={15} />}
          </>
        )}
      </Button>
    </div>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
      <AlertTriangle size={15} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- the wizard */

export function CreateWizard({ preloadDesignId }: { preloadDesignId: string | null }) {
  // Remount the run to get a pristine state machine for "Create another".
  const [run, setRun] = useState(0);
  return (
    <WizardRun
      key={run}
      preloadDesignId={run === 0 ? preloadDesignId : null}
      onReset={() => setRun((r) => r + 1)}
    />
  );
}

function WizardRun({ preloadDesignId, onReset }: { preloadDesignId: string | null; onReset: () => void }) {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  /* step 1 — upload */
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [styleBrief, setStyleBrief] = useState("");
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadedFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* step 2 — designs */
  const [designs, setDesigns] = useState<Design[]>([]);
  const [generating, setGenerating] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [useOriginal, setUseOriginal] = useState(false);

  /* step 3 — copy */
  const [tone, setTone] = useState<Tone>("confident");
  const [captionSets, setCaptionSets] = useState<CaptionSet[] | null>(null);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [chosenCaption, setChosenCaption] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [firstCommentOn, setFirstCommentOn] = useState(false);
  const [firstComment, setFirstComment] = useState("");
  const captionsRequestedRef = useRef(false);

  /* step 4 — destinations */
  const [accounts, setAccounts] = useState<ClientAccount[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [surfaces, setSurfaces] = useState<PostSurface[]>(["feed"]);

  /* step 5 — timing */
  const [timingMode, setTimingMode] = useState<TimingMode>("now");
  const [scheduledLocal, setScheduledLocal] = useState("");

  /* step 6 — launch */
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [createdPosts, setCreatedPosts] = useState<Post[] | null>(null);

  const [preloading, setPreloading] = useState(Boolean(preloadDesignId));

  const goTo = (i: number) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
  };

  /* ------------------------------------------------------------ effects */

  // Object URL for the local file preview.
  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Accounts load once — used by destinations, review, and design usernames.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await api<{ accounts: ClientAccount[] }>("/api/accounts");
      if (cancelled) return;
      if (r.ok) setAccounts(r.data.accounts);
      else {
        setAccounts([]);
        setAccountsError(r.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ?design= — preload a library design as the selected media and jump to Copy.
  useEffect(() => {
    if (!preloadDesignId) {
      setPreloading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await api<{ designs: Design[] }>("/api/designs");
      if (cancelled) return;
      setPreloading(false);
      if (!r.ok) return;
      const d = r.data.designs.find((x) => x.id === preloadDesignId);
      if (!d) return;
      setDesigns([d]);
      setSelectedDesignIds([d.id]);
      setFormat(d.format);
      if (d.brief) setStyleBrief(d.brief);
      setUseOriginal(false);
      setStep(2);
      setMaxReached(2);
      void postPatchSelected(d.id, true);
    })();
    return () => {
      cancelled = true;
    };
  }, [preloadDesignId]);

  // Entering Copy the first time auto-writes captions.
  useEffect(() => {
    if (STEPS[step].id !== "copy") return;
    if (captionsRequestedRef.current) return;
    captionsRequestedRef.current = true;
    void runCaptions(tone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ------------------------------------------------------------ derived */

  const fileIsVideo = file ? file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(file.name) : false;

  const captionBrief = useMemo(() => {
    const parts = [headline.trim(), sub.trim(), styleBrief.trim()].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
    const d = designs.find((x) => selectedDesignIds.includes(x.id));
    return d?.brief ?? d?.label ?? "An Instagram post";
  }, [headline, sub, styleBrief, designs, selectedDesignIds]);

  const selectedDesigns = useMemo(
    () =>
      selectedDesignIds
        .map((id) => designs.find((d) => d.id === id))
        .filter((d): d is Design => Boolean(d)),
    [selectedDesignIds, designs],
  );

  const mediaUrls = useMemo(() => {
    if (useOriginal && asset) return [asset.public_url];
    return selectedDesigns.map((d) => d.public_url);
  }, [useOriginal, asset, selectedDesigns]);

  const accountById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);

  const suggestedSlots = useMemo(
    () =>
      [slotAt(1, 11), slotAt(1, 18), slotAt(2, 11)].map((d) => ({
        value: toLocalInput(d),
        label: slotLabel(d),
      })),
    [],
  );

  const postCount = selectedAccountIds.length * surfaces.length;

  /* ------------------------------------------------------------ actions */

  function postPatchSelected(designId: string, selected: boolean): Promise<unknown> {
    return fetch(`/api/designs/${designId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    }).catch(() => null);
  }

  function onFile(f: File) {
    const isVideo = f.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(f.name);
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      setUploadError("Upload an image (JPEG, PNG, WebP) or an MP4 video.");
      return;
    }
    setUploadError(null);
    setFile(f);
  }

  async function continueFromUpload() {
    if (!file || !headline.trim() || uploading) return;
    setUploadError(null);

    let current = asset;
    const needsUpload = !current || uploadedFileRef.current !== file;
    if (needsUpload) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: fd });
      setUploading(false);
      if (!r.ok) {
        setUploadError(r.error);
        return;
      }
      current = r.data.asset;
      uploadedFileRef.current = file;
      setAsset(current);
      // A fresh upload invalidates any previous design run.
      setDesigns([]);
      setSelectedDesignIds([]);
      setUseOriginal(false);
    }
    if (!current) return;

    if (current.kind === "video") {
      // Designs are generated from photos — the video posts as-is.
      setUseOriginal(true);
      goTo(2);
      return;
    }
    goTo(1);
    if (needsUpload || !designs.some((d) => d.asset_id === current.id)) {
      void runGenerate(current);
    }
  }

  async function runGenerate(a: Asset) {
    if (generating) return;
    setGenerating(true);
    setDesignError(null);
    const r = await postJson<{ designs: Design[] }>("/api/designs/generate", {
      asset_id: a.id,
      headline: headline.trim() || "Untitled",
      sub: sub.trim() || undefined,
      brief: styleBrief.trim() || undefined,
      format,
      username: accounts?.[0]?.username,
    });
    setGenerating(false);
    if (!r.ok) {
      setDesignError(r.error);
      return;
    }
    setDesigns((prev) => [...r.data.designs, ...prev]);
  }

  function toggleDesign(d: Design) {
    setUseOriginal(false);
    const wasSelected = selectedDesignIds.includes(d.id);
    setSelectedDesignIds((sel) => (wasSelected ? sel.filter((x) => x !== d.id) : [...sel, d.id]));
    void postPatchSelected(d.id, !wasSelected);
  }

  function chooseOriginal() {
    for (const id of selectedDesignIds) void postPatchSelected(id, false);
    setSelectedDesignIds([]);
    setUseOriginal(true);
  }

  async function runCaptions(t: Tone) {
    setCaptionLoading(true);
    setCaptionError(null);
    const r = await postJson<{ captions: CaptionSet[] }>("/api/captions", {
      brief: captionBrief,
      tone: t,
      n: 3,
      surface: "feed",
    });
    setCaptionLoading(false);
    if (!r.ok) {
      setCaptionError(r.error);
      return;
    }
    setCaptionSets(r.data.captions);
    setChosenCaption(null);
  }

  function chooseCaption(index: number) {
    const set = captionSets?.[index];
    if (!set) return;
    setChosenCaption(index);
    setCaption(set.caption);
    setHashtags(set.hashtags.map((h) => h.replace(/^#+/, "")));
    if (set.first_comment) {
      setFirstComment(set.first_comment);
      setFirstCommentOn(true);
    }
  }

  function addHashtag(raw: string) {
    const tag = raw.trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!tag) return;
    setHashtags((h) => (h.includes(tag) ? h : [...h, tag]));
    setHashtagInput("");
  }

  function toggleFirstComment(on: boolean) {
    setFirstCommentOn(on);
    if (on && !firstComment.trim() && hashtags.length > 0) {
      setFirstComment(hashtags.map((h) => `#${h}`).join(" "));
    }
  }

  async function launch() {
    if (launching) return;
    setLaunching(true);
    setLaunchError(null);
    const r = await postJson<{ posts: Post[] }>("/api/posts", {
      account_ids: selectedAccountIds,
      surfaces,
      caption: caption.trim(),
      hashtags,
      first_comment: firstCommentOn && firstComment.trim() ? firstComment.trim() : null,
      media_urls: mediaUrls,
      design_ids: useOriginal ? [] : selectedDesignIds,
      scheduled_at:
        timingMode === "schedule" && scheduledLocal ? new Date(scheduledLocal).toISOString() : null,
      publish_now: timingMode === "now",
    });
    setLaunching(false);
    if (!r.ok) {
      setLaunchError(r.error);
      return;
    }
    setCreatedPosts(r.data.posts);
  }

  /* ------------------------------------------------------------- render */

  const header = (
    <PageHeader
      overline="The machine"
      title="Create"
      description="One photo in — designed, captioned, and launched to every account and surface you pick."
      actions={
        <Link
          href="/library"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-line-2 text-sm font-semibold text-paper-dim hover:text-paper hover:border-paper/40 transition-colors"
        >
          <Images size={15} /> Library
        </Link>
      }
    />
  );

  if (preloading) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center py-32 gap-3 text-paper-dim text-sm">
          <Spinner /> Loading your design&hellip;
        </div>
      </div>
    );
  }

  if (createdPosts) {
    const failed = createdPosts.filter((p) => p.status === "failed");
    return (
      <div>
        {header}
        <Card className="grain relative overflow-hidden animate-rise">
          <div className="flex flex-col items-center text-center px-8 py-14">
            <CheckCircle2 className="text-lime w-12 h-12" />
            <h2 className="display text-3xl text-paper mt-4">
              {timingMode === "now" ? "Launched." : "Scheduled."}
            </h2>
            <p className="text-sm text-paper-dim mt-2 max-w-md">
              {createdPosts.length} {createdPosts.length === 1 ? "post" : "posts"}{" "}
              {timingMode === "now" ? "sent to the publishing engine" : "dropped on the calendar"}.
              {failed.length > 0 ? ` ${failed.length} failed — retry from the calendar.` : ""}
            </p>

            <div className="w-full max-w-lg mt-8 flex flex-col gap-2 text-left">
              {createdPosts.map((p) => {
                const acct = accountById.get(p.account_id);
                return (
                  <div key={p.id} className="card bg-ink-3/50 flex items-center gap-3 px-4 py-3">
                    <span className="text-sm font-semibold text-paper truncate">
                      @{acct?.username ?? "account"}
                    </span>
                    <Badge tone="neutral">{p.surface}</Badge>
                    <span className="ml-auto flex items-center gap-2">
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      {p.ig_permalink ? (
                        <a
                          href={p.ig_permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-paper-dim hover:text-paper transition-colors"
                          aria-label="Open on Instagram"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            {failed.length > 0 && failed[0].error ? (
              <p className="text-xs text-danger mt-3 max-w-lg">{failed[0].error}</p>
            ) : null}

            <div className="flex items-center gap-3 mt-10">
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-line-2 text-sm font-semibold text-paper hover:border-paper/40 transition-colors"
              >
                Open calendar
              </Link>
              <Button variant="accent" onClick={onReset}>
                Create another
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const stepId = STEPS[step].id;

  return (
    <div>
      {header}
      <Stepper steps={STEPS} current={step} maxReached={maxReached} onSelect={setStep} />

      {/* ============================================================ UPLOAD */}
      {stepId === "upload" ? (
        <section className="animate-rise">
          <StepHeading
            index={0}
            title="Feed the machine"
            hint="One strong photo (or an MP4 for reels) plus the words you want on it."
          />
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              className={cn(
                "card card-hover cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center min-h-96 p-6 border-dashed transition-colors",
                dragging && "border-accent bg-accent-soft",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              {filePreview ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  {fileIsVideo ? (
                    <video src={filePreview} muted playsInline className="max-h-72 rounded-lg object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={filePreview} alt="Upload preview" className="max-h-72 rounded-lg object-contain" />
                  )}
                  <div className="text-xs text-paper-dim truncate max-w-full">{file?.name}</div>
                  <div className="microlabel">Click or drop to replace</div>
                </div>
              ) : (
                <>
                  <UploadCloud className="text-muted w-9 h-9 mb-4" />
                  <div className="display text-xl text-paper">Drop your photo here</div>
                  <p className="text-sm text-paper-dim mt-1.5 max-w-xs">
                    JPEG, PNG, or WebP — or an MP4 if this run is a reel. Click to browse.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <Field label="Headline" hint="The text the designs are built around.">
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Summer drop is live"
                  maxLength={200}
                />
              </Field>
              <Field label="Sub-line (optional)">
                <Input
                  value={sub}
                  onChange={(e) => setSub(e.target.value)}
                  placeholder="Free shipping this week only"
                  maxLength={300}
                />
              </Field>
              <Field label="Style brief (optional)" hint="Direction for the designers — mood, colors, vibe.">
                <Textarea
                  value={styleBrief}
                  onChange={(e) => setStyleBrief(e.target.value)}
                  placeholder="Warm, editorial, lots of negative space. Premium but playful."
                  maxLength={2000}
                />
              </Field>
              <Field label="Format">
                <Tabs
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: "feed", label: "Feed post · 4:5" },
                    { value: "story", label: "Story · 9:16" },
                  ]}
                />
              </Field>
              {uploadError ? <ErrorNote message={uploadError} /> : null}
            </div>
          </div>
          <StepNav
            onNext={() => void continueFromUpload()}
            nextDisabled={!file || !headline.trim()}
            busy={uploading}
            busyLabel="Uploading"
          />
        </section>
      ) : null}

      {/* =========================================================== DESIGNS */}
      {stepId === "designs" ? (
        <section className="animate-rise">
          <StepHeading
            index={1}
            title="Pick your designs"
            hint="Select one — or several for a carousel. Or skip the machine and post the original."
          />

          {asset?.kind === "video" ? (
            <Card className="p-8 flex items-start gap-4">
              <Film className="text-accent shrink-0 mt-1" size={20} />
              <div>
                <div className="display text-xl text-paper">Video upload — designs skipped</div>
                <p className="text-sm text-paper-dim mt-1.5 max-w-xl">
                  Design variants are generated from photos. Your video will be posted as-is — continue to
                  write the copy.
                </p>
              </div>
            </Card>
          ) : generating && designs.length === 0 ? (
            <Card className="grain relative overflow-hidden">
              <div className="flex flex-col items-center justify-center text-center px-8 py-20">
                <Spinner className="w-7 h-7 mb-5" />
                <div className="display text-2xl text-paper">The machine is designing&hellip;</div>
                <p className="text-sm text-paper-dim mt-2 max-w-sm">
                  Template variants render locally; any configured AI providers join the run. Up to a minute.
                </p>
                <div className="flex items-center gap-2 mt-5">
                  <Badge tone="neutral">template</Badge>
                  <Badge tone="paper">openai</Badge>
                  <Badge tone="accent">anthropic</Badge>
                  <Badge tone="lime">higgsfield</Badge>
                  <Badge tone="warn">replicate</Badge>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {Array.from(new Set(designs.map((d) => d.provider))).map((p) => (
                    <Badge key={p} tone={PROVIDER_TONES[p]}>
                      {p}
                    </Badge>
                  ))}
                  {generating ? (
                    <span className="flex items-center gap-2 text-xs text-paper-dim">
                      <Spinner /> designing more&hellip;
                    </span>
                  ) : null}
                </div>
                {asset ? (
                  <Button variant="outline" size="sm" onClick={() => void runGenerate(asset)} disabled={generating}>
                    <RefreshCw size={13} className={cn(generating && "animate-spin")} /> Regenerate
                  </Button>
                ) : null}
              </div>

              {designError ? (
                <div className="mb-4">
                  <ErrorNote message={designError} onRetry={asset ? () => void runGenerate(asset) : undefined} />
                </div>
              ) : null}

              {designs.length === 0 && !generating ? (
                <EmptyState
                  icon={<Images />}
                  title="No designs yet"
                  description="Run the machine on your upload, or go back and add a photo first."
                  action={
                    asset ? (
                      <Button variant="accent" onClick={() => void runGenerate(asset)}>
                        Generate designs
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => setStep(0)}>
                        Back to upload
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {asset && asset.kind === "image" ? (
                    <button
                      type="button"
                      onClick={chooseOriginal}
                      className={cn(
                        "card card-hover overflow-hidden text-left relative cursor-pointer",
                        useOriginal && "border-accent ring-1 ring-accent",
                      )}
                    >
                      <div className={cn("relative w-full overflow-hidden bg-ink-3", format === "story" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.public_url} alt="Original photo" className="w-full h-full object-cover" />
                        {useOriginal ? (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-ink flex items-center justify-center">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span className="text-xs font-medium text-paper truncate">Use original photo</span>
                        <Badge tone="neutral">original</Badge>
                      </div>
                    </button>
                  ) : null}

                  {designs.map((d) => {
                    const order = selectedDesignIds.indexOf(d.id);
                    const isSel = order >= 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDesign(d)}
                        className={cn(
                          "card card-hover overflow-hidden text-left relative cursor-pointer",
                          isSel && "border-accent ring-1 ring-accent",
                        )}
                      >
                        <div
                          className={cn(
                            "relative w-full overflow-hidden bg-ink-3",
                            d.format === "story" ? "aspect-[9/16]" : "aspect-[4/5]",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.public_url} alt={d.label} className="w-full h-full object-cover" />
                          {isSel ? (
                            <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-ink flex items-center justify-center text-[11px] font-bold">
                              {order + 1}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <span className="text-xs font-medium text-paper truncate">{d.label}</span>
                          <Badge tone={PROVIDER_TONES[d.provider]}>{d.provider}</Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedDesignIds.length > 1 ? (
                <p className="text-xs text-paper-dim mt-4">
                  {selectedDesignIds.length} designs selected — carousel unlocked in Destinations. Numbers show
                  slide order.
                </p>
              ) : null}
            </>
          )}

          <StepNav
            onBack={() => setStep(0)}
            onNext={() => goTo(2)}
            nextDisabled={!useOriginal && selectedDesignIds.length === 0}
          />
        </section>
      ) : null}

      {/* ============================================================== COPY */}
      {stepId === "copy" ? (
        <section className="animate-rise">
          <StepHeading
            index={2}
            title="Write the copy"
            hint="Three takes on your brief. Pick one, then make it yours."
          />

          <div className="flex flex-wrap items-end gap-3 mb-5">
            <Field label="Tone">
              <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="w-44">
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={() => void runCaptions(tone)} disabled={captionLoading}>
              <RefreshCw size={14} className={cn(captionLoading && "animate-spin")} /> Regenerate
            </Button>
          </div>

          {captionError ? (
            <div className="mb-4">
              <ErrorNote message={captionError} onRetry={() => void runCaptions(tone)} />
            </div>
          ) : null}

          {captionLoading ? (
            <Card className="flex items-center justify-center gap-3 py-16 text-sm text-paper-dim">
              <Spinner /> The machine is writing&hellip;
            </Card>
          ) : captionSets && captionSets.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {captionSets.map((set, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => chooseCaption(i)}
                  className={cn(
                    "card card-hover p-4 text-left cursor-pointer flex flex-col gap-3",
                    chosenCaption === i && "border-accent ring-1 ring-accent",
                  )}
                >
                  <p className="text-sm text-paper-dim whitespace-pre-line leading-relaxed line-clamp-6">
                    {set.caption}
                  </p>
                  <p className="text-xs text-accent break-words mt-auto">
                    {set.hashtags.map((h) => `#${h.replace(/^#+/, "")}`).join(" ")}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {chosenCaption !== null || caption.trim() ? (
            <div className="mt-6 grid lg:grid-cols-2 gap-6 items-start">
              <Field label="Caption">
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="min-h-44"
                  placeholder="Your caption"
                />
                <span className={cn("text-xs mt-1", caption.length > 2200 ? "text-danger" : "text-muted")}>
                  {caption.length} / 2200 &middot; first 125 characters show in feed
                </span>
              </Field>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <span className="microlabel">Hashtags</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1.5 bg-ink-3 border border-line rounded-full pl-3 pr-2 h-8 text-xs font-medium text-paper"
                      >
                        #{h}
                        <button
                          type="button"
                          onClick={() => setHashtags((all) => all.filter((x) => x !== h))}
                          className="text-muted hover:text-paper transition-colors cursor-pointer"
                          aria-label={`Remove #${h}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <Input
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addHashtag(hashtagInput);
                        }
                      }}
                      onBlur={() => addHashtag(hashtagInput)}
                      placeholder="Add tag + Enter"
                      className="w-36 h-8 text-xs"
                    />
                  </div>
                  {hashtags.length > 5 ? (
                    <span className="text-xs text-warn flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {hashtags.length} tags — Instagram now rewards 3&ndash;5
                      laser-relevant hashtags.
                    </span>
                  ) : (
                    <span className="text-xs text-muted">3&ndash;5 relevant tags perform best.</span>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  <Toggle
                    checked={firstCommentOn}
                    onChange={toggleFirstComment}
                    label="Add a first comment (posted right after publish)"
                  />
                  {firstCommentOn ? (
                    <Textarea
                      value={firstComment}
                      onChange={(e) => setFirstComment(e.target.value)}
                      placeholder="Extra value, context, or the hashtags you want out of the caption."
                      className="min-h-24"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : captionSets && !captionLoading ? (
            <p className="text-sm text-muted mt-5">Pick a caption above to edit it.</p>
          ) : null}

          <StepNav onBack={() => setStep(1)} onNext={() => goTo(3)} nextDisabled={!caption.trim()} />
        </section>
      ) : null}

      {/* ====================================================== DESTINATIONS */}
      {stepId === "destinations" ? (
        <section className="animate-rise">
          <StepHeading
            index={3}
            title="Choose destinations"
            hint="Any account, any surface — every combination becomes its own post."
          />

          {accounts === null ? (
            <div className="flex items-center justify-center py-24 gap-3 text-sm text-paper-dim">
              <Spinner /> Loading accounts&hellip;
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<AtSign />}
              title="No Instagram accounts connected"
              description={
                accountsError ??
                "Connect a professional (Business or Creator) account to publish. It takes about a minute."
              }
              action={
                <Link
                  href="/accounts"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-accent text-ink text-sm font-semibold hover:brightness-110 transition-all"
                >
                  Connect an account
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-7">
              <div>
                <div className="microlabel mb-3">Accounts</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accounts.map((a) => {
                    const sel = selectedAccountIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setSelectedAccountIds((ids) =>
                            sel ? ids.filter((x) => x !== a.id) : [...ids, a.id],
                          )
                        }
                        className={cn(
                          "card card-hover p-4 flex items-center gap-3 text-left cursor-pointer",
                          sel && "border-accent ring-1 ring-accent",
                        )}
                      >
                        <span className="ig-ring rounded-full p-[2px] shrink-0">
                          <span className="block w-10 h-10 rounded-full overflow-hidden bg-ink-3 border-2 border-ink-2">
                            {a.profile_picture_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.profile_picture_url}
                                alt={a.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-sm font-bold text-paper-dim">
                                {a.username.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-paper truncate">@{a.username}</span>
                          <span className="block text-xs text-muted mt-0.5">
                            {formatCompact(a.followers_count)} followers
                          </span>
                        </span>
                        {sel ? <Check size={16} className="text-accent shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="microlabel mb-3">Surfaces</div>
                <SegmentedMulti
                  values={surfaces}
                  onChange={setSurfaces}
                  options={[
                    { value: "feed" as PostSurface, label: "Feed" },
                    { value: "reel" as PostSurface, label: "Reel", disabled: asset?.kind !== "video" },
                    { value: "story" as PostSurface, label: "Story" },
                    {
                      value: "carousel" as PostSurface,
                      label: "Carousel",
                      disabled: selectedDesignIds.length < 2,
                    },
                  ]}
                />
                <div className="flex flex-col gap-1 mt-3 text-xs text-muted">
                  {asset?.kind !== "video" ? (
                    <span>Reels need a video — this run uses a photo.</span>
                  ) : null}
                  {selectedDesignIds.length < 2 ? (
                    <span>Carousel unlocks when you select two or more designs.</span>
                  ) : null}
                  {surfaces.includes("story") && format === "feed" ? (
                    <span className="text-warn">
                      Stories run on a 9:16 canvas — your 4:5 media will be cropped by Instagram. Generate in
                      Story format for a perfect fit.
                    </span>
                  ) : null}
                </div>
              </div>

              {postCount > 0 ? (
                <Card className="px-5 py-4 flex items-baseline gap-3 w-fit">
                  <span className="stat-number text-3xl text-accent">{postCount}</span>
                  <span className="text-sm text-paper-dim">
                    {postCount === 1 ? "post" : "posts"} will be created — {selectedAccountIds.length}{" "}
                    {selectedAccountIds.length === 1 ? "account" : "accounts"} &times; {surfaces.length}{" "}
                    {surfaces.length === 1 ? "surface" : "surfaces"}
                  </span>
                </Card>
              ) : null}
            </div>
          )}

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => goTo(4)}
            nextDisabled={selectedAccountIds.length === 0 || surfaces.length === 0}
          />
        </section>
      ) : null}

      {/* ============================================================ TIMING */}
      {stepId === "timing" ? (
        <section className="animate-rise">
          <StepHeading index={4} title="Now or later" hint="Publish immediately, or drop it on the calendar." />

          <Tabs
            value={timingMode}
            onChange={setTimingMode}
            options={[
              { value: "now", label: "Post now" },
              { value: "schedule", label: "Schedule" },
            ]}
            className="mb-5"
          />

          {timingMode === "now" ? (
            <Card className="p-6 max-w-xl">
              <div className="display text-lg text-paper">Straight to Instagram</div>
              <p className="text-sm text-paper-dim mt-1.5">
                All {postCount > 0 ? postCount : ""} posts go to the publishing engine the moment you hit
                Launch on the next step.
              </p>
            </Card>
          ) : (
            <Card className="p-6 max-w-xl flex flex-col gap-5">
              <Field label="Date &amp; time">
                <Input
                  type="datetime-local"
                  value={scheduledLocal}
                  min={toLocalInput(new Date())}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="microlabel">Suggested</span>
                <div className="flex flex-wrap gap-2">
                  {suggestedSlots.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setScheduledLocal(s.value)}
                      className={cn(
                        "px-4 h-9 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                        scheduledLocal === s.value
                          ? "bg-accent text-ink border-accent"
                          : "bg-transparent text-paper-dim border-line-2 hover:border-paper/40 hover:text-paper",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted">
                  Suggested slots — mid-morning and early-evening windows in your local time.
                </span>
              </div>
            </Card>
          )}

          <StepNav
            onBack={() => setStep(3)}
            onNext={() => goTo(5)}
            nextDisabled={timingMode === "schedule" && !scheduledLocal}
          />
        </section>
      ) : null}

      {/* ============================================================ REVIEW */}
      {stepId === "review" ? (
        <section className="animate-rise">
          <StepHeading index={5} title="Final look" hint="Exactly what goes out. Launch when it feels right." />

          <div className="grid lg:grid-cols-[minmax(0,384px)_1fr] gap-8 items-start">
            <IgPreview
              username={
                (selectedAccountIds.length > 0
                  ? accountById.get(selectedAccountIds[0])?.username
                  : undefined) ?? "yourbrand"
              }
              avatarUrl={
                (selectedAccountIds.length > 0
                  ? accountById.get(selectedAccountIds[0])?.profile_picture_url
                  : null) ?? null
              }
              mediaUrl={mediaUrls[0] ?? null}
              isVideo={useOriginal && asset?.kind === "video"}
              caption={caption}
              hashtags={hashtags}
              format={selectedDesigns[0]?.format ?? format}
            />

            <div className="flex flex-col gap-5">
              <Card className="divide-y divide-line">
                <SummaryRow label="Media">
                  <span className="flex items-center gap-2 flex-wrap">
                    {mediaUrls.slice(0, 4).map((url) =>
                      useOriginal && asset?.kind === "video" ? (
                        <span
                          key={url}
                          className="w-10 h-10 rounded-md bg-ink-3 border border-line flex items-center justify-center text-paper-dim"
                        >
                          <Film size={14} />
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt="Selected media"
                          className="w-10 h-10 rounded-md object-cover border border-line"
                        />
                      ),
                    )}
                    <span className="text-sm text-paper-dim">
                      {mediaUrls.length} {mediaUrls.length === 1 ? "item" : "items"}
                      {useOriginal ? " · original upload" : " · generated designs"}
                    </span>
                  </span>
                </SummaryRow>
                <SummaryRow label="Accounts">
                  <span className="text-sm text-paper">
                    {selectedAccountIds
                      .map((id) => `@${accountById.get(id)?.username ?? "unknown"}`)
                      .join(", ")}
                  </span>
                </SummaryRow>
                <SummaryRow label="Surfaces">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {surfaces.map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                  </span>
                </SummaryRow>
                <SummaryRow label="Timing">
                  <span className="text-sm text-paper">
                    {timingMode === "now"
                      ? "Publish immediately"
                      : scheduledLocal
                        ? new Date(scheduledLocal).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                  </span>
                </SummaryRow>
                <SummaryRow label="First comment">
                  <span className="text-sm text-paper-dim">
                    {firstCommentOn && firstComment.trim() ? firstComment.trim().slice(0, 80) : "Off"}
                  </span>
                </SummaryRow>
                <SummaryRow label="Total">
                  <span className="stat-number text-2xl text-accent">{postCount}</span>
                  <span className="text-sm text-paper-dim ml-2">
                    {postCount === 1 ? "post" : "posts"}
                  </span>
                </SummaryRow>
              </Card>

              {launchError ? <ErrorNote message={launchError} onRetry={() => void launch()} /> : null}

              <div className="flex flex-col items-start gap-2">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => void launch()}
                  disabled={launching || mediaUrls.length === 0 || postCount === 0}
                  className="px-10"
                >
                  {launching ? (
                    <>
                      <Spinner /> {timingMode === "now" ? "Publishing" : "Scheduling"}&hellip;
                    </>
                  ) : (
                    <>
                      <Rocket size={16} /> Launch {postCount} {postCount === 1 ? "post" : "posts"}
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted">
                  {timingMode === "now"
                    ? "Publishing runs through the official Instagram API — this can take a minute."
                    : "The dispatcher publishes automatically at the scheduled time."}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center mt-8 pt-5 border-t border-line">
            <Button variant="ghost" onClick={() => setStep(4)}>
              <ArrowLeft size={15} /> Back
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <span className="microlabel w-28 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 flex items-center flex-wrap gap-y-1">{children}</span>
    </div>
  );
}
