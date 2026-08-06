/** Central domain types. The database rows in supabase/migrations/0001_init.sql mirror these. */

export type PostSurface = "feed" | "reel" | "story" | "carousel";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";
export type DesignProvider = "template" | "openai" | "anthropic" | "higgsfield" | "replicate";
export type OutreachStatus = "queued" | "followed" | "skipped" | "followed_back" | "unfollowed";
export type AccountStatus = "active" | "token_expiring" | "token_expired" | "error";
export type GiveawayStatus = "draft" | "live" | "closed" | "drawn";
export type CampaignStatus = "draft" | "planned" | "materialized" | "running" | "done";

export interface IgAccount {
  id: string;
  user_id: string;
  ig_user_id: string;
  username: string;
  name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  media_count: number;
  access_token_enc: string;
  token_expires_at: string | null;
  status: AccountStatus;
  connected_at: string;
  last_synced_at: string | null;
}

export interface Asset {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  original_name: string | null;
  created_at: string;
}

export interface Design {
  id: string;
  user_id: string;
  asset_id: string | null;
  provider: DesignProvider;
  template_key: string | null;
  label: string;
  brief: string | null;
  storage_path: string;
  public_url: string;
  width: number;
  height: number;
  format: "feed" | "story";
  selected: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  account_id: string;
  campaign_id: string | null;
  surface: PostSurface;
  caption: string;
  hashtags: string[];
  first_comment: string | null;
  media_urls: string[];
  design_ids: string[];
  status: PostStatus;
  publish_step: "create_container" | "wait_container" | "publish" | null;
  scheduled_at: string | null;
  published_at: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  error: string | null;
  publish_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignDay {
  day: number;
  date: string;
  theme: string;
  surface: PostSurface;
  design_direction: string;
  caption_draft: string;
  hashtags: string[];
  best_time: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  goal: string;
  brief: string;
  start_date: string;
  days: number;
  account_ids: string[];
  status: CampaignStatus;
  plan: CampaignDay[] | null;
  created_at: string;
}

export interface GiveawayRequirements {
  must_follow: boolean;
  must_like: boolean;
  mention_count: number;
  keyword: string | null;
  hashtag: string | null;
}

export interface Giveaway {
  id: string;
  user_id: string;
  account_id: string;
  post_id: string | null;
  ig_media_id: string | null;
  title: string;
  prize: string;
  starts_at: string;
  ends_at: string;
  winner_count: number;
  requirements: GiveawayRequirements;
  status: GiveawayStatus;
  draw_seed: string | null;
  drawn_at: string | null;
  entries_synced_at: string | null;
  created_at: string;
}

export interface GiveawayEntry {
  id: string;
  giveaway_id: string;
  user_id: string;
  ig_comment_id: string;
  username: string;
  text: string;
  mention_count: number;
  checks: { hasKeyword: boolean; hasHashtag: boolean; mentionOk: boolean };
  eligible: boolean;
  commented_at: string | null;
}

export interface GiveawayWinner {
  id: string;
  giveaway_id: string;
  user_id: string;
  entry_id: string;
  username: string;
  draw_index: number;
  drawn_at: string;
  disqualified: boolean;
}

export interface OutreachTarget {
  id: string;
  user_id: string;
  username: string;
  source_url: string | null;
  status: OutreachStatus;
  assigned_account_id: string | null;
  followers_count: number | null;
  media_count: number | null;
  full_name: string | null;
  biography: string | null;
  notes: string | null;
  followed_at: string | null;
  created_at: string;
}

export interface OutreachSettings {
  user_id: string;
  daily_target: number;
  active_start_hour: number;
  active_end_hour: number;
}

export interface AccountInsightsSnapshot {
  id: string;
  user_id: string;
  account_id: string;
  captured_at: string;
  followers_count: number;
  reach_day: number | null;
  online_followers: Record<string, number[]> | null;
}

export interface PostMetrics {
  id: string;
  user_id: string;
  post_id: string;
  captured_at: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
}

export interface CaptionSet {
  caption: string;
  hashtags: string[];
  first_comment?: string;
}

export interface ActivityEvent {
  id: string;
  user_id: string;
  kind: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** Surface → render dimensions. */
export const SURFACE_DIMENSIONS: Record<"feed" | "story", { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};
