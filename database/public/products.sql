create table public.products (
  id uuid not null default gen_random_uuid (),
  name character varying(200) not null,
  slug character varying(200) not null,
  description text null,
  price numeric(10, 2) not null,
  stock_quantity integer null default 0,
  category_id uuid null,
  is_active boolean null default true,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint products_pkey primary key (id),
  constraint products_slug_key unique (slug),
  constraint products_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint products_created_by_fkey foreign KEY (created_by) references user_profiles (id) on delete set null,
  constraint products_price_check check ((price >= (0)::numeric)),
  constraint products_stock_quantity_check check ((stock_quantity >= 0))
) TABLESPACE pg_default;

create index IF not exists idx_products_category on public.products using btree (category_id) TABLESPACE pg_default;

create index IF not exists idx_products_slug on public.products using btree (slug) TABLESPACE pg_default;

create index IF not exists idx_products_active on public.products using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create trigger update_products_updated_at BEFORE
update on products for EACH row
execute FUNCTION update_updated_at_column ();