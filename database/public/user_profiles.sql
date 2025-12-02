create table public.user_profiles (
  id uuid not null,
  email text not null,
  username text null,
  first_name text null,
  last_name text null,
  avatar_url text null,
  phone text null,
  street_address text null,
  city text null,
  postal_code text null,
  country text null,
  provider text null,
  locale text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  role public.user_role not null default 'user'::user_role,
  is_banned boolean null default false,
  ban_reason text null,
  banned_at timestamp with time zone null,
  banned_by uuid null,
  last_login_at timestamp with time zone null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_email_key unique (email),
  constraint user_profiles_banned_by_fkey foreign KEY (banned_by) references user_profiles (id) on delete set null,
  constraint user_profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint user_profiles_provider_check check (
    (
      provider = any (
        array['google'::text, 'github'::text, 'email'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_last_login on public.user_profiles using btree (last_login_at) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_email on public.user_profiles using btree (email) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_provider on public.user_profiles using btree (provider) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_role on public.user_profiles using btree (role) TABLESPACE pg_default;

create index IF not exists idx_user_profiles_banned on public.user_profiles using btree (is_banned) TABLESPACE pg_default
where
  (is_banned = true);

create trigger on_user_profile_updated BEFORE
update on user_profiles for EACH row
execute FUNCTION handle_updated_at ();

create trigger protect_role_trigger BEFORE
update on user_profiles for EACH row
execute FUNCTION protect_user_role_and_ban ();

create trigger update_user_profiles_updated_at BEFORE
update on user_profiles for EACH row
execute FUNCTION update_updated_at_column ();