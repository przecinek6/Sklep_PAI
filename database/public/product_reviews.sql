create table public.product_reviews (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  user_id uuid not null,
  rating integer not null,
  title character varying(200) null,
  content text not null,
  is_approved boolean not null default false,
  approved_by uuid null,
  approved_at timestamp with time zone null,
  is_deleted boolean not null default false,
  helpful_count integer not null default 0,
  not_helpful_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_reviews_pkey primary key (id),
  constraint product_reviews_approved_by_fkey foreign KEY (approved_by) references user_profiles (id) on delete set null,
  constraint product_reviews_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint product_reviews_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint product_reviews_helpful_count_check check ((helpful_count >= 0)),
  constraint product_reviews_not_helpful_count_check check ((not_helpful_count >= 0)),
  constraint product_reviews_rating_check check (
    (
      (rating >= 1)
      and (rating <= 5)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_product_reviews_product_id on public.product_reviews using btree (product_id) TABLESPACE pg_default;

create index IF not exists idx_product_reviews_user_id on public.product_reviews using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_product_reviews_approved on public.product_reviews using btree (is_approved) TABLESPACE pg_default
where
  (
    (is_approved = true)
    and (is_deleted = false)
  );

create index IF not exists idx_product_reviews_pending on public.product_reviews using btree (is_approved, created_at) TABLESPACE pg_default
where
  (
    (is_approved = false)
    and (is_deleted = false)
  );

create trigger update_product_reviews_updated_at BEFORE
update on product_reviews for EACH row
execute FUNCTION update_updated_at_column ();