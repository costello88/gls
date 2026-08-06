/**
 * Resumable publish state machine. Each call advances a post at most one or
 * two steps, so long video processing spans multiple cron ticks instead of
 * blocking a serverless function.
 *
 *   scheduled → publishing(create_container) → publishing(wait_container)
 *             → publishing(publish) → published | failed
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IgAccount, Post } from "@/lib/types";
import { decryptToken } from "@/lib/crypto";
import {
  createContainer,
  containerStatus,
  publishContainer,
  publishingLimit,
  postComment,
  getPermalink,
} from "@/lib/meta/publish";

const MAX_ATTEMPTS = 3;

export async function advancePost(post: Post, supa: SupabaseClient): Promise<void> {
  const { data: account } = await supa
    .from("ig_accounts")
    .select("*")
    .eq("id", post.account_id)
    .single<IgAccount>();

  if (!account) {
    await fail(post, supa, "Connected account no longer exists");
    return;
  }

  let token: string;
  try {
    token = decryptToken(account.access_token_enc);
  } catch {
    await fail(post, supa, "Could not decrypt the account token — reconnect the account");
    return;
  }

  try {
    if (post.status === "scheduled" || post.publish_step === "create_container" || !post.publish_step) {
      // Quota guard before creating a container.
      try {
        const { used, quota } = await publishingLimit(account.ig_user_id, token);
        if (used >= quota) {
          await fail(post, supa, `Publishing quota reached (${used}/${quota} in 24h) — try again later`);
          return;
        }
      } catch {
        // Quota check is advisory; continue on failure.
      }

      const containerId = await createContainerFor(post, account, token);
      await supa
        .from("posts")
        .update({ status: "publishing", publish_step: "wait_container", ig_container_id: containerId })
        .eq("id", post.id);

      // Images are usually ready immediately — try to finish in the same tick.
      const { status } = await containerStatus(containerId, token);
      if (status === "FINISHED") {
        await doPublish({ ...post, ig_container_id: containerId }, account, token, supa);
      } else if (status === "ERROR" || status === "EXPIRED") {
        await retryOrFail(post, supa, `Media container ${status.toLowerCase()}`);
      }
      return;
    }

    if (post.publish_step === "wait_container") {
      if (!post.ig_container_id) {
        await retryOrFail(post, supa, "Lost container id");
        return;
      }
      const { status, detail } = await containerStatus(post.ig_container_id, token);
      if (status === "FINISHED") {
        await doPublish(post, account, token, supa);
      } else if (status === "ERROR" || status === "EXPIRED") {
        await retryOrFail(post, supa, detail || `Media container ${status.toLowerCase()}`);
      }
      // IN_PROGRESS → wait for the next tick.
      return;
    }

    if (post.publish_step === "publish") {
      await doPublish(post, account, token, supa);
    }
  } catch (err) {
    await retryOrFail(post, supa, err instanceof Error ? err.message : "Publish failed");
  }
}

async function createContainerFor(post: Post, account: IgAccount, token: string): Promise<string> {
  const mediaUrl = post.media_urls[0];
  if (!mediaUrl) throw new Error("Post has no media");

  if (post.surface === "carousel") {
    const children: string[] = [];
    for (const url of post.media_urls.slice(0, 10)) {
      const childId = await createContainer(account.ig_user_id, token, {
        surface: "feed",
        imageUrl: isVideoUrl(url) ? undefined : url,
        videoUrl: isVideoUrl(url) ? url : undefined,
        isCarouselItem: true,
      });
      children.push(childId);
    }
    return createContainer(account.ig_user_id, token, {
      surface: "carousel",
      children,
      caption: fullCaption(post),
    });
  }

  const video = isVideoUrl(mediaUrl);
  return createContainer(account.ig_user_id, token, {
    surface: post.surface,
    imageUrl: video ? undefined : mediaUrl,
    videoUrl: video ? mediaUrl : undefined,
    caption: post.surface === "story" ? undefined : fullCaption(post),
  });
}

async function doPublish(
  post: Post,
  account: IgAccount,
  token: string,
  supa: SupabaseClient,
): Promise<void> {
  if (!post.ig_container_id) throw new Error("No container to publish");
  const mediaId = await publishContainer(account.ig_user_id, token, post.ig_container_id);
  const permalink = await getPermalink(mediaId, token);

  await supa
    .from("posts")
    .update({
      status: "published",
      publish_step: null,
      ig_media_id: mediaId,
      ig_permalink: permalink,
      published_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", post.id);

  await supa.from("activity_log").insert({
    user_id: post.user_id,
    kind: "publish",
    message: `Published ${post.surface} to @${account.username}`,
    meta: { post_id: post.id, ig_media_id: mediaId },
  });

  if (post.first_comment && post.surface !== "story") {
    try {
      await postComment(mediaId, token, post.first_comment);
    } catch {
      // First comment is best-effort.
    }
  }
}

async function retryOrFail(post: Post, supa: SupabaseClient, message: string): Promise<void> {
  const attempts = post.publish_attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await fail(post, supa, message, attempts);
    return;
  }
  // Reset to the start of the machine; the next cron tick retries fresh.
  await supa
    .from("posts")
    .update({
      status: "scheduled",
      publish_step: null,
      ig_container_id: null,
      publish_attempts: attempts,
      error: `${message} (attempt ${attempts}/${MAX_ATTEMPTS})`,
    })
    .eq("id", post.id);
}

async function fail(post: Post, supa: SupabaseClient, message: string, attempts?: number): Promise<void> {
  await supa
    .from("posts")
    .update({
      status: "failed",
      publish_step: null,
      error: message,
      publish_attempts: attempts ?? post.publish_attempts,
    })
    .eq("id", post.id);

  await supa.from("activity_log").insert({
    user_id: post.user_id,
    kind: "publish_failed",
    message: `Failed to publish ${post.surface}: ${message}`,
    meta: { post_id: post.id },
  });
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v)(\?|$)/i.test(url);
}

function fullCaption(post: Post): string {
  const tags = post.hashtags.length ? `\n\n${post.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}` : "";
  return `${post.caption}${tags}`.slice(0, 2200);
}
