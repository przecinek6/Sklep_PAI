create table public.email_notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  notification_type public.notification_type not null,
  subject character varying(255) not null,
  body text not null,
  email_to character varying(255) not null,
  status public.email_notification_status not null default 'pending'::email_notification_status,
  sent_at timestamp with time zone null,
  error_message text null,
  retry_count integer not null default 0,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint email_notifications_pkey primary key (id),
  constraint email_notifications_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint email_notifications_retry_count_check check ((retry_count >= 0))
) TABLESPACE pg_default;

create index IF not exists idx_email_notifications_user_id on public.email_notifications using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_email_notifications_status on public.email_notifications using btree (status, created_at) TABLESPACE pg_default;

create index IF not exists idx_email_notifications_pending on public.email_notifications using btree (created_at) TABLESPACE pg_default
where
  (status = 'pending'::email_notification_status);

create index IF not exists idx_email_notifications_type on public.email_notifications using btree (notification_type) TABLESPACE pg_default;

create trigger trigger_set_email_sent_at BEFORE
update on email_notifications for EACH row
execute FUNCTION set_email_sent_at ();

create trigger update_email_notifications_updated_at BEFORE
update on email_notifications for EACH row
execute FUNCTION update_updated_at_column ();