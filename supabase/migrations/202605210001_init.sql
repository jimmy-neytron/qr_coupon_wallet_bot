create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  type text not null check (type in ('personal', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null unique,
  created_by_user_id uuid not null references public.app_users(id) on delete cascade,
  used_by_user_id uuid references public.app_users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_groups (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, title)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  group_id uuid references public.coupon_groups(id) on delete set null,
  created_by_user_id uuid references public.app_users(id) on delete set null,
  title text not null default 'Купон' check (length(trim(title)) between 1 and 120),
  qr_text text not null check (length(trim(qr_text)) > 0),
  note text,
  type text not null default 'qr' check (type in ('qr', 'text')),
  expires_at date,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_telegram_user_id_idx on public.app_users (telegram_user_id);
create index if not exists spaces_owner_user_id_idx on public.spaces (owner_user_id);
create index if not exists space_members_user_id_idx on public.space_members (user_id);
create index if not exists space_invites_code_idx on public.space_invites (code);
create index if not exists coupon_groups_space_id_idx on public.coupon_groups (space_id);
create index if not exists coupons_space_id_idx on public.coupons (space_id);
create index if not exists coupons_group_id_idx on public.coupons (group_id);
create index if not exists coupons_created_by_user_id_idx on public.coupons (created_by_user_id);
create index if not exists coupons_favorite_idx on public.coupons (space_id, is_favorite desc);
create index if not exists coupons_archived_idx on public.coupons (space_id, is_archived);

-- Prevent active duplicates inside the same space. Archived duplicates are allowed.
create unique index if not exists coupons_unique_active_qr_per_space_idx
  on public.coupons (space_id, md5(qr_text))
  where is_archived = false;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

drop trigger if exists set_spaces_updated_at on public.spaces;
create trigger set_spaces_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

drop trigger if exists set_coupon_groups_updated_at on public.coupon_groups;
create trigger set_coupon_groups_updated_at
  before update on public.coupon_groups
  for each row execute function public.set_updated_at();

drop trigger if exists set_coupons_updated_at on public.coupons;
create trigger set_coupons_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.coupon_groups enable row level security;
alter table public.coupons enable row level security;

-- The app uses Supabase Edge Functions with service-role/secret keys.
-- No public RLS policies are added intentionally: direct anon access remains closed.
