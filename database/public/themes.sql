create table public.themes (
  id uuid not null default gen_random_uuid (),
  name character varying(100) not null,
  primary_color character varying(7) not null,
  secondary_color character varying(7) not null,
  accent_color character varying(7) not null,
  is_active boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  background_color character varying(7) null,
  surface_color character varying(7) null,
  constraint themes_pkey primary key (id),
  constraint themes_name_key unique (name),
  constraint themes_created_by_fkey foreign KEY (created_by) references user_profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_themes_active on public.themes using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger trigger_single_active_theme BEFORE INSERT
or
update on themes for EACH row when (new.is_active = true)
execute FUNCTION ensure_single_active_theme ();

create trigger update_themes_updated_at BEFORE
update on themes for EACH row
execute FUNCTION update_updated_at_column ();