import { graph } from "./client";

export interface IgComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  from?: { id: string; username: string };
  like_count?: number;
  parent_id?: string;
}

/** Paginated comments on a media object (50 per page). */
export async function mediaComments(
  mediaId: string,
  token: string,
  after?: string,
): Promise<{ comments: IgComment[]; next: string | null }> {
  const body = await graph<{
    data: IgComment[];
    paging?: { cursors?: { after?: string }; next?: string };
  }>(`/${mediaId}/comments`, token, {
    params: {
      fields: "id,text,timestamp,username,from,like_count,parent_id",
      limit: 50,
      after,
    },
  });
  return {
    comments: body.data ?? [],
    next: body.paging?.next ? (body.paging?.cursors?.after ?? null) : null,
  };
}

/** Account-level daily reach. */
export async function accountReach(igUserId: string, token: string): Promise<number | null> {
  try {
    const body = await graph<{
      data: Array<{ total_value?: { value: number }; values?: Array<{ value: number }> }>;
    }>(`/${igUserId}/insights`, token, {
      params: { metric: "reach", period: "day", metric_type: "total_value" },
    });
    const m = body.data?.[0];
    return m?.total_value?.value ?? m?.values?.at(-1)?.value ?? null;
  } catch {
    return null;
  }
}

/** Hourly audience-online heatmap (when available). Returns { "0".."6": number[24] }. */
export async function onlineFollowers(
  igUserId: string,
  token: string,
): Promise<Record<string, number[]> | null> {
  try {
    const body = await graph<{
      data: Array<{ values?: Array<{ value: Record<string, number>; end_time: string }> }>;
    }>(`/${igUserId}/insights`, token, {
      params: { metric: "online_followers", period: "lifetime" },
    });
    const values = body.data?.[0]?.values;
    if (!values?.length) return null;

    // Aggregate hour buckets by weekday across returned days.
    const byDay: Record<string, number[]> = {};
    for (const v of values) {
      const weekday = String((new Date(v.end_time).getDay() + 6) % 7);
      const row = (byDay[weekday] ??= new Array(24).fill(0));
      for (const [hour, count] of Object.entries(v.value ?? {})) {
        const h = Number(hour);
        if (h >= 0 && h < 24) row[h] += count;
      }
    }
    return byDay;
  } catch {
    return null;
  }
}

export interface MediaMetrics {
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  reach: number;
}

export async function mediaInsights(mediaId: string, token: string): Promise<MediaMetrics | null> {
  try {
    const body = await graph<{
      data: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>;
    }>(`/${mediaId}/insights`, token, {
      params: { metric: "likes,comments,saved,shares,reach" },
    });
    const get = (name: string) => {
      const m = body.data?.find((d) => d.name === name);
      return m?.total_value?.value ?? m?.values?.[0]?.value ?? 0;
    };
    return {
      likes: get("likes"),
      comments: get("comments"),
      saved: get("saved"),
      shares: get("shares"),
      reach: get("reach"),
    };
  } catch {
    return null;
  }
}

export interface DiscoveredProfile {
  username: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

/**
 * Business Discovery: public info about ANOTHER professional account by username.
 * Fails (code 110) for personal/private accounts — callers treat null as "not discoverable".
 */
export async function businessDiscovery(
  igUserId: string,
  token: string,
  targetUsername: string,
): Promise<DiscoveredProfile | null> {
  try {
    const body = await graph<{ business_discovery: DiscoveredProfile }>(`/${igUserId}`, token, {
      params: {
        fields: `business_discovery.username(${targetUsername}){username,name,biography,followers_count,media_count,profile_picture_url}`,
      },
    });
    return body.business_discovery ?? null;
  } catch {
    return null;
  }
}
