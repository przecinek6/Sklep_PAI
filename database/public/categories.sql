create table public.categories (
  id uuid not null default gen_random_uuid (),
  name character varying(100) not null,
  slug character varying(100) not null,
  description text null,
  parent_id uuid null,
  display_order integer null default 0,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug),
  constraint categories_parent_id_fkey foreign KEY (parent_id) references categories (id) on delete set null,
  constraint check_not_self_parent check ((id <> parent_id))
) TABLESPACE pg_default;

create index IF not exists idx_categories_parent on public.categories using btree (parent_id) TABLESPACE pg_default;

create index IF not exists idx_categories_slug on public.categories using btree (slug) TABLESPACE pg_default;

create index IF not exists idx_categories_active on public.categories using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger update_categories_updated_at BEFORE
update on categories for EACH row
execute FUNCTION update_updated_at_column ();