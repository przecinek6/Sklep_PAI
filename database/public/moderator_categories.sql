-- Moderator categories assignment table (many-to-many)
create table public.moderator_categories (
  id uuid not null default gen_random_uuid (),
  moderator_id uuid not null,
  category_id uuid not null,
  assigned_by uuid null,
  assigned_at timestamp with time zone not null default now(),
  constraint moderator_categories_pkey primary key (id),
  constraint moderator_categories_moderator_id_fkey foreign key (moderator_id) references user_profiles (id) on delete cascade,
  constraint moderator_categories_category_id_fkey foreign key (category_id) references categories (id) on delete cascade,
  constraint moderator_categories_assigned_by_fkey foreign key (assigned_by) references user_profiles (id) on delete set null,
  constraint moderator_categories_unique unique (moderator_id, category_id)
) tablespace pg_default;

-- Indexes for efficient queries
create index if not exists idx_moderator_categories_moderator_id on public.moderator_categories using btree (moderator_id) tablespace pg_default;

create index if not exists idx_moderator_categories_category_id on public.moderator_categories using btree (category_id) tablespace pg_default;

-- RLS Policies
alter table moderator_categories enable row level security;

-- Admins can manage all assignments
create policy "Admins can manage moderator category assignments"
  on moderator_categories for all
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Moderators can view their own assignments
create policy "Moderators can view their assignments"
  on moderator_categories for select
  using (auth.uid() = moderator_id);
