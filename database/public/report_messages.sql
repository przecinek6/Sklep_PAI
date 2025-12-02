create table public.report_messages (
  id uuid not null default gen_random_uuid (),
  report_id uuid not null,
  user_id uuid not null,
  message text not null,
  is_moderator_message boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint report_messages_pkey primary key (id),
  constraint report_messages_report_id_fkey foreign KEY (report_id) references product_reports (id) on delete CASCADE,
  constraint report_messages_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_report_messages_report_id on public.report_messages using btree (report_id, created_at) TABLESPACE pg_default;

create index IF not exists idx_report_messages_user_id on public.report_messages using btree (user_id) TABLESPACE pg_default;

create trigger trigger_update_report_status_on_message
after INSERT on report_messages for EACH row
execute FUNCTION update_report_status_on_message ();