-- Postcraft schema. Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- accounts
create table public.ig_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  name text,
  profile_picture_url text,
  followers_count integer not null default 0,
  media_count integer not null default 0,
  access_token_enc text not null,
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active','token_expiring','token_expired','error')),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (user_id, ig_user_id)
);

-- ---------------------------------------------------------------- media
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null default 'image' check (kind in ('image','video')),
  width integer,
  height integer,
  original_name text,
  created_at timestamptz not null default now()
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  provider text not null check (provider in ('template','openai','anthropic','higgsfield','replicate')),
  template_key text,
  label text not null default '',
  brief text,
  storage_path text not null,
  public_url text not null,
  width integer not null,
  height integer not null,
  format text not null default 'feed' check (format in ('feed','story')),
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- campaigns
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  goal text not null default '',
  brief text not null default '',
  start_date date not null,
  days integer not null default 7,
  account_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','planned','materialized','running','done')),
  plan jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.ig_accounts (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  surface text not null check (surface in ('feed','reel','story','carousel')),
  caption text not null default '',
  hashtags text[] not null default '{}',
  first_comment text,
  media_urls text[] not null default '{}',
  design_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed')),
  publish_step text check (publish_step in ('create_container','wait_container','publish')),
  scheduled_at timestamptz,
  published_at timestamptz,
  ig_container_id text,
  ig_media_id text,
  ig_permalink text,
  error text,
  publish_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_due_idx on public.posts (status, scheduled_at);
create index posts_user_idx on public.posts (user_id, status, scheduled_at);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- giveaways
create table public.giveaways (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.ig_accounts (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  ig_media_id text,
  title text not null,
  prize text not null default '',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  winner_count integer not null default 1 check (winner_count between 1 and 100),
  requirements jsonb not null default '{"must_follow":true,"must_like":true,"mention_count":0,"keyword":null,"hashtag":null}',
  status text not null default 'draft' check (status in ('draft','live','closed','drawn')),
  draw_seed text,
  drawn_at timestamptz,
  entries_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ig_comment_id text not null,
  username text not null,
  text text not null default '',
  mention_count integer not null default 0,
  checks jsonb not null default '{}',
  eligible boolean not null default false,
  commented_at timestamptz,
  unique (giveaway_id, ig_comment_id)
);

create index giveaway_entries_idx on public.giveaway_entries (giveaway_id, eligible);

create table public.giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.giveaway_entries (id) on delete cascade,
  username text not null,
  draw_index integer not null,
  drawn_at timestamptz not null default now(),
  disqualified boolean not null default false
);

-- ---------------------------------------------------------------- outreach
create table public.outreach_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  source_url text,
  status text not null default 'queued' check (status in ('queued','followed','skipped','followed_back','unfollowed')),
  assigned_account_id uuid references public.ig_accounts (id) on delete set null,
  followers_count integer,
  media_count integer,
  full_name text,
  biography text,
  notes text,
  followed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, username)
);

create index outreach_queue_idx on public.outreach_targets (user_id, status, created_at);

create table public.outreach_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_target integer not null default 30 check (daily_target between 1 and 200),
  active_start_hour integer not null default 9,
  active_end_hour integer not null default 21
);

-- ---------------------------------------------------------------- insights
create table public.account_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.ig_accounts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  followers_count integer not null default 0,
  reach_day integer,
  online_followers jsonb
);

create index account_insights_idx on public.account_insights (account_id, captured_at desc);

create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  reach integer not null default 0
);

-- ---------------------------------------------------------------- activity
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_idx on public.activity_log (user_id, created_at desc);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'ig_accounts','assets','designs','campaigns','posts',
    'giveaways','giveaway_entries','giveaway_winners',
    'outreach_targets','outreach_settings','account_insights','post_metrics','activity_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- storage
-- Public bucket: Instagram requires publicly reachable media URLs at publish time.
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

create policy "media_read_public" on storage.objects
  for select using (bucket_id = 'media');
create policy "media_insert_own" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_delete_own" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
