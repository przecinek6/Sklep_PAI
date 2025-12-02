create table public.product_questions (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  user_id uuid not null,
  question text not null,
  is_answered boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_questions_pkey primary key (id),
  constraint product_questions_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint product_questions_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_product_questions_product_id on public.product_questions using btree (product_id) TABLESPACE pg_default;

create index IF not exists idx_product_questions_user_id on public.product_questions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_product_questions_unanswered on public.product_questions using btree (is_answered, created_at) TABLESPACE pg_default
where
  (is_answered = false);

create trigger update_product_questions_updated_at BEFORE
update on product_questions for EACH row
execute FUNCTION update_updated_at_column ();