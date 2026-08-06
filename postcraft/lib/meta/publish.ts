/**
 * Content publishing: container flow.
 * POST /{ig-user-id}/media → poll status_code → POST /{ig-user-id}/media_publish.
 * Media must be on a publicly reachable URL; images must be JPEG.
 */

import { graph } from "./client";
import type { PostSurface } from "@/lib/types";

export interface ContainerParams {
  surface: PostSurface;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  children?: string[];
  shareToFeed?: boolean;
  coverUrl?: string;
  isCarouselItem?: boolean;
}

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

/** Map our surface model onto Graph API container params. */
export function containerParams(p: ContainerParams): Record<string, string | boolean | undefined> {
  switch (p.surface) {
    case "feed":
      if (p.videoUrl) {
        // Feed video is published as a reel with share_to_feed.
        return {
          media_type: "REELS",
          video_url: p.videoUrl,
          caption: p.caption,
          share_to_feed: true,
          cover_url: p.coverUrl,
        };
      }
      return p.isCarouselItem
        ? { image_url: p.imageUrl, is_carousel_item: true }
        : { image_url: p.imageUrl, caption: p.caption };
    case "reel":
      return {
        media_type: "REELS",
        video_url: p.videoUrl,
        caption: p.caption,
        share_to_feed: p.shareToFeed ?? true,
        cover_url: p.coverUrl,
      };
    case "story":
      return p.videoUrl
        ? { media_type: "STORIES", video_url: p.videoUrl }
        : { media_type: "STORIES", image_url: p.imageUrl };
    case "carousel":
      return {
        media_type: "CAROUSEL",
        children: p.children?.join(","),
        caption: p.caption,
      };
  }
}

export async function createContainer(
  igUserId: string,
  token: string,
  params: ContainerParams,
): Promise<string> {
  const body = await graph<{ id: string }>(`/${igUserId}/media`, token, {
    method: "POST",
    params: containerParams(params) as Record<string, string | boolean>,
  });
  return body.id;
}

export async function containerStatus(
  containerId: string,
  token: string,
): Promise<{ status: ContainerStatus; detail?: string }> {
  const body = await graph<{ status_code: ContainerStatus; status?: string }>(
    `/${containerId}`,
    token,
    { params: { fields: "status_code,status" } },
  );
  return { status: body.status_code, detail: body.status };
}

export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<string> {
  const body = await graph<{ id: string }>(`/${igUserId}/media_publish`, token, {
    method: "POST",
    params: { creation_id: containerId },
  });
  return body.id;
}

export async function publishingLimit(
  igUserId: string,
  token: string,
): Promise<{ used: number; quota: number }> {
  const body = await graph<{
    data: Array<{ quota_usage: number; config?: { quota_total: number } }>;
  }>(`/${igUserId}/content_publishing_limit`, token, {
    params: { fields: "quota_usage,config" },
  });
  const row = body.data?.[0];
  return { used: row?.quota_usage ?? 0, quota: row?.config?.quota_total ?? 50 };
}

export async function postComment(mediaId: string, token: string, message: string): Promise<string> {
  const body = await graph<{ id: string }>(`/${mediaId}/comments`, token, {
    method: "POST",
    params: { message },
  });
  return body.id;
}

export async function getPermalink(mediaId: string, token: string): Promise<string | null> {
  try {
    const body = await graph<{ permalink?: string }>(`/${mediaId}`, token, {
      params: { fields: "permalink" },
    });
    return body.permalink ?? null;
  } catch {
    return null;
  }
}
