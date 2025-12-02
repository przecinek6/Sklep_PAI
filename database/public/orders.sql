create table public.orders (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  order_number character varying(50) not null,
  status character varying(50) not null default 'pending'::character varying,
  payment_status character varying(50) not null default 'pending'::character varying,
  total_amount numeric(10, 2) not null,
  shipping_cost numeric(10, 2) null default 0,
  shipping_address_street character varying(255) null,
  shipping_address_city character varying(100) null,
  shipping_address_postal_code character varying(20) null,
  shipping_address_country character varying(100) null default 'Polska'::character varying,
  stripe_payment_intent_id character varying(255) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint orders_pkey primary key (id),
  constraint orders_order_number_key unique (order_number),
  constraint orders_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint orders_total_amount_check check ((total_amount >= (0)::numeric)),
  constraint orders_shipping_cost_check check ((shipping_cost >= (0)::numeric)),
  constraint orders_payment_status_check check (
    (
      (payment_status)::text = any (
        (
          array[
            'pending'::character varying,
            'processing'::character varying,
            'paid'::character varying,
            'failed'::character varying,
            'refunded'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint orders_status_check check (
    (
      (status)::text = any (
        (
          array[
            'pending'::character varying,
            'processing'::character varying,
            'shipped'::character varying,
            'delivered'::character varying,
            'cancelled'::character varying,
            'refunded'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_orders_user_id on public.orders using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_orders_order_number on public.orders using btree (order_number) TABLESPACE pg_default;

create index IF not exists idx_orders_payment_status on public.orders using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_orders_created_at on public.orders using btree (created_at desc) TABLESPACE pg_default;

create trigger update_orders_updated_at BEFORE
update on orders for EACH row
execute FUNCTION update_updated_at_column ();