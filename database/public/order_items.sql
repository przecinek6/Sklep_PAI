create table public.order_items (
  id uuid not null default gen_random_uuid (),
  order_id uuid not null,
  product_id uuid not null,
  quantity integer not null default 1,
  price numeric(10, 2) not null,
  created_at timestamp with time zone null default now(),
  constraint order_items_pkey primary key (id),
  constraint order_items_order_id_fkey foreign KEY (order_id) references orders (id) on delete CASCADE,
  constraint order_items_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT,
  constraint order_items_price_check check ((price >= (0)::numeric)),
  constraint order_items_quantity_check check ((quantity > 0))
) TABLESPACE pg_default;

create index IF not exists idx_order_items_order_id on public.order_items using btree (order_id) TABLESPACE pg_default;

create index IF not exists idx_order_items_product_id on public.order_items using btree (product_id) TABLESPACE pg_default;