create table public.product_reports (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  user_id uuid not null,
  reason text not null,
  status public.report_status not null default 'pending'::report_status,
  assigned_to uuid null,
  resolved_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_reports_pkey primary key (id),
  constraint product_reports_assigned_to_fkey foreign KEY (assigned_to) references user_profiles (id) on delete set null,
  constraint product_reports_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint product_reports_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_product_reports_product_id on public.product_reports using btree (product_id) TABLESPACE pg_default;

create index IF not exists idx_product_reports_user_id on public.product_reports using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_product_reports_status on public.product_reports using btree (status, created_at) TABLESPACE pg_default;

create index IF not exists idx_product_reports_assigned_to on public.product_reports using btree (assigned_to) TABLESPACE pg_default
where
  (assigned_to is not null);

create trigger trigger_set_resolved_at BEFORE
update on product_reports for EACH row
execute FUNCTION set_resolved_at ();

create trigger update_product_reports_updated_at BEFORE
update on product_reports for EACH row
execute FUNCTION update_updated_at_column ();