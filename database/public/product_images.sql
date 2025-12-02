create table public.product_images (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  original_url text not null,
  thumbnail_url text null,
  medium_url text null,
  large_url text null,
  display_order integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_product_images_product on public.product_images using btree (product_id) TABLESPACE pg_default;