create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  notification_type character varying(50) not null,
  title character varying(255) not null,
  message text not null,
  link character varying(500) null,
  is_read boolean not null default false,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone null,
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint notifications_type_check check (
    (
      (notification_type)::text = any (
        (
          array[
            'order_status'::character varying,
            'order_cancelled'::character varying,
            'payment_success'::character varying,
            'payment_failed'::character varying,
            'review_approved'::character varying,
            'review_rejected'::character varying,
            'question_answered'::character varying,
            'report_response'::character varying,
            'product_added'::character varying,
            'system'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_unread on public.notifications using btree (user_id, is_read, created_at desc) TABLESPACE pg_default
where
  (is_read = false);

create index IF not exists idx_notifications_type on public.notifications using btree (notification_type) TABLESPACE pg_default;

-- Trigger to set read_at timestamp when is_read changes to true
create or replace function set_notification_read_at()
returns trigger as $$
begin
  if new.is_read = true and old.is_read = false then
    new.read_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_set_notification_read_at
before update on notifications
for each row
execute function set_notification_read_at();

-- Enable Row Level Security
alter table notifications enable row level security;

-- Policy: Users can only see their own notifications
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- Policy: System can insert notifications
create policy "System can insert notifications"
  on notifications for insert
  with check (true);
