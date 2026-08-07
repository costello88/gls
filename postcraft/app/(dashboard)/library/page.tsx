"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Images, Sparkles, Star } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/interactive";
import { timeAgo, cn } from "@/lib/utils";
import type { Asset, Design, DesignProvider } from "@/lib/types";

const PROVIDERS: Array<DesignProvider | "all"> = [
  "all",
  "template",
  "anthropic",
  "openai",
  "replicate",
  "higgsfield",
];

const PROVIDER_LABEL: Record<string, string> = {
  all: "All",
  template: "Templates",
  anthropic: "Claude",
  openai: "OpenAI",
  replicate: "Flux",
  higgsfield: "Higgsfield",
};

export default function LibraryPage() {
  const [tab, setTab] = useState<"designs" | "uploads">("designs");
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [provider, setProvider] = useState<DesignProvider | "all">("all");

  useEffect(() => {
    void (async () => {
      const [d, a] = await Promise.all([fetch("/api/designs"), fetch("/api/assets")]);
      if (d.ok) setDesigns(((await d.json()) as { designs: Design[] }).designs);
      else setDesigns([]);
      if (a.ok) setAssets(((await a.json()) as { assets: Asset[] }).assets);
      else setAssets([]);
    })();
  }, []);

  const visibleDesigns = (designs ?? []).filter((d) => provider === "all" || d.provider === provider);

  return (
    <div>
      <PageHeader
        overline="Assets"
        title="Library"
        description="Every upload and every generated design — reusable in one click."
        actions={
          <Link href="/create">
            <Button variant="accent">
              <Sparkles size={14} /> Create post
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "designs", label: `Designs${designs ? ` · ${designs.length}` : ""}` },
            { value: "uploads", label: `Uploads${assets ? ` · ${assets.length}` : ""}` },
          ]}
        />
        {tab === "designs" ? (
          <div className="flex flex-wrap gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={cn(
                  "px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer",
                  provider === p
                    ? "bg-paper text-ink border-paper"
                    : "text-paper-dim border-line-2 hover:text-paper",
                )}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "designs" ? (
        designs === null ? (
          <Loading />
        ) : visibleDesigns.length === 0 ? (
          <EmptyState
            icon={<Images />}
            title={provider === "all" ? "No designs yet" : `No ${PROVIDER_LABEL[provider]} designs yet`}
            description="Run a photo through the machine — it comes back as a full set of designs."
            action={
              <Link href="/create">
                <Button variant="accent">Start creating</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleDesigns.map((d) => (
              <div key={d.id} className="card card-hover overflow-hidden group relative">
                <div className={cn("relative", d.format === "story" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.public_url}
                    alt={d.label}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {d.selected ? (
                    <Star size={14} className="absolute top-2 right-2 text-accent fill-accent" />
                  ) : null}
                  <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href={`/create?design=${d.id}`}>
                      <Button variant="accent" size="sm">
                        Send to Create
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-paper truncate">{d.label}</span>
                  <Badge tone={d.provider === "template" ? "neutral" : "accent"}>
                    {PROVIDER_LABEL[d.provider]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )
      ) : assets === null ? (
        <Loading />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="No uploads yet"
          description="Everything you upload lands here, ready to be remixed into new designs."
          action={
            <Link href="/create">
              <Button variant="accent">Upload a photo</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="card card-hover overflow-hidden group">
              <div className="relative aspect-square">
                {a.kind === "video" ? (
                  <video src={a.public_url} className="absolute inset-0 w-full h-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.public_url}
                    alt={a.original_name ?? "upload"}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-xs text-paper-dim truncate">
                  {a.original_name ?? a.kind} · {timeAgo(a.created_at)}
                </span>
                {a.kind === "video" ? <Badge>video</Badge> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-20">
      <Spinner />
    </div>
  );
}
