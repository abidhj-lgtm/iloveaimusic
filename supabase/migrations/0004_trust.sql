alter table reports add column if not exists resolution_note text not null default '';
alter table reports add column if not exists resolved_by uuid references profiles(id) on delete set null;
alter table reports add column if not exists target_owner uuid references profiles(id) on delete set null;

create index if not exists reports_status_reason_idx on reports (status, reason, created_at desc);
create index if not exists reports_owner_idx on reports (target_owner, created_at desc);
create unique index if not exists reports_one_open_per_reporter
  on reports (reporter_id, coalesce(track_id::text,''), coalesce(comment_id::text,''))
  where status in ('open','reviewing');

create table if not exists track_rights (
  track_id uuid primary key references tracks(id) on delete cascade,
  attested boolean not null default false,
  license text not null default 'all_rights_reserved',
  ai_tool text not null default 'unspecified',
  human_contribution text not null default '',
  explicit boolean not null default false,
  third_party_samples boolean not null default false,
  monetizable boolean not null default false,
  distribution_ok boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists user_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  weight int not null default 1 check (weight between 1 and 3),
  issued_by uuid references profiles(id) on delete set null,
  report_id uuid references reports(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists user_strikes_user_idx on user_strikes (user_id, created_at desc);

create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text not null check (target_type in ('track','comment','report','profile')),
  target_id text not null,
  before_state jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index if not exists moderation_batch_idx on moderation_actions (batch_id);
create index if not exists moderation_recent_idx on moderation_actions (created_at desc);

create table if not exists staff_roles (
  user_id uuid primary key references profiles(id) on delete cascade,
  role user_role not null,
  granted_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['track_rights','user_strikes','moderation_actions','staff_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;