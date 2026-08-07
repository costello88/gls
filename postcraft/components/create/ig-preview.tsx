"use client";

import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const CAPTION_TRUNCATE = 125;

/** Instagram-style post preview used on the wizard review step. */
export function IgPreview({
  username,
  avatarUrl,
  mediaUrl,
  isVideo = false,
  caption,
  hashtags,
  format,
}: {
  username: string;
  avatarUrl: string | null;
  mediaUrl: string | null;
  isVideo?: boolean;
  caption: string;
  hashtags: string[];
  format: "feed" | "story";
}) {
  const truncated = caption.length > CAPTION_TRUNCATE;
  const shown = truncated ? caption.slice(0, CAPTION_TRUNCATE).trimEnd() : caption;

  return (
    <div className="card overflow-hidden max-w-sm w-full">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="ig-ring rounded-full p-[2px] shrink-0">
          <span className="block w-8 h-8 rounded-full overflow-hidden bg-ink-3 border-2 border-ink-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xs font-bold text-paper-dim">
                {username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        </span>
        <span className="text-sm font-semibold text-paper truncate">{username}</span>
        <MoreHorizontal size={16} className="ml-auto text-paper-dim shrink-0" />
      </div>

      <div
        className={cn(
          "relative w-full bg-ink-3 overflow-hidden",
          format === "story" ? "aspect-[9/16]" : "aspect-[4/5]",
        )}
      >
        {mediaUrl ? (
          isVideo ? (
            <video src={mediaUrl} muted playsInline className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Post media" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted">
            No media selected
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 px-3.5 pt-3 text-paper">
        <Heart size={20} />
        <MessageCircle size={20} />
        <Send size={20} />
        <Bookmark size={20} className="ml-auto" />
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-1.5">
        <p className="text-sm text-paper leading-snug whitespace-pre-line break-words">
          <span className="font-semibold">{username}</span>{" "}
          <span className="text-paper-dim">{shown || "Your caption will appear here."}</span>
          {truncated ? <span className="text-muted">&hellip; more</span> : null}
        </p>
        {hashtags.length > 0 ? (
          <p className="text-sm text-accent leading-snug break-words">
            {hashtags.map((h) => `#${h}`).join(" ")}
          </p>
        ) : null}
        <p className="text-[10px] text-muted uppercase tracking-[0.12em]">Just now</p>
      </div>
    </div>
  );
}
