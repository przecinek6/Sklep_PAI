create table public.slider_template_products (
  id uuid not null default gen_random_uuid (),
  template_id uuid not null,
  product_id uuid not null,
  display_order integer not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint slider_template_products_pkey primary key (id),
  constraint slider_template_products_template_id_product_id_key unique (template_id, product_id),
  constraint slider_template_products_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint slider_template_products_template_id_fkey foreign KEY (template_id) references slider_templates (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_slider_template_products_template on public.slider_template_products using btree (template_id, display_order) TABLESPACE pg_default;

create index IF not exists idx_slider_template_products_product on public.slider_template_products using btree (product_id) TABLESPACE pg_default;