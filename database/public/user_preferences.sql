create table public.user_preferences (
  user_id uuid not null,
  theme_id uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_preferences_pkey primary key (user_id),
  constraint user_preferences_theme_id_fkey foreign KEY (theme_id) references themes (id) on delete set null,
  constraint user_preferences_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_preferences_user_id on public.user_preferences using btree (user_id) TABLESPACE pg_default;

create trigger update_user_preferences_updated_at BEFORE
update on user_preferences for EACH row
execute FUNCTION update_updated_at_column ();