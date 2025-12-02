create table public.cart_items (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  session_id text null,
  product_id uuid not null,
  quantity integer not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint cart_items_pkey primary key (id),
  constraint cart_items_unique_session_product unique (session_id, product_id),
  constraint cart_items_unique_user_product unique (user_id, product_id),
  constraint cart_items_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint cart_items_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint cart_items_user_or_session_check check (
    (
      (
        (user_id is not null)
        and (session_id is null)
      )
      or (
        (user_id is null)
        and (session_id is not null)
      )
    )
  ),
  constraint cart_items_quantity_check check ((quantity > 0))
) TABLESPACE pg_default;

create index IF not exists idx_cart_items_user_id on public.cart_items using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_cart_items_session_id on public.cart_items using btree (session_id) TABLESPACE pg_default;

create index IF not exists idx_cart_items_product_id on public.cart_items using btree (product_id) TABLESPACE pg_default;

create trigger update_cart_items_updated_at BEFORE
update on cart_items for EACH row
execute FUNCTION update_updated_at_column ();