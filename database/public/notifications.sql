-- Unified notifications table (in-app + email notifications)
create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  notification_type character varying(50) not null,
  
  -- Common fields
  title character varying(255) not null,
  message text not null,
  link character varying(500) null,
  metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  
  -- In-app notification fields
  is_read boolean not null default false,
  read_at timestamp with time zone null,
  
  -- Email notification fields
  delivery_method character varying(20) not null default 'in_app',
  email_to character varying(255) null,
  email_subject character varying(255) null,
  email_body text null,
  email_status character varying(20) null,
  email_sent_at timestamp with time zone null,
  email_error_message text null,
  email_retry_count integer not null default 0,
  
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
            'new_review'::character varying,
            'new_question'::character varying,
            'question_answered'::character varying,
            'report_response'::character varying,
            'product_added'::character varying,
            'system'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint notifications_delivery_method_check check (
    (delivery_method)::text = any (array['in_app'::text, 'email'::text, 'both'::text])
  ),
  constraint notifications_email_status_check check (
    (email_status is null) or (email_status)::text = any (array['pending'::text, 'sent'::text, 'failed'::text])
  ),
  constraint notifications_email_retry_count_check check (email_retry_count >= 0)
) TABLESPACE pg_default;

-- Indexes
create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_notifications_unread on public.notifications using btree (user_id, is_read, created_at desc) TABLESPACE pg_default
where
  (is_read = false and delivery_method in ('in_app', 'both'));

create index IF not exists idx_notifications_type on public.notifications using btree (notification_type) TABLESPACE pg_default;

create index IF not exists idx_notifications_email_pending on public.notifications using btree (created_at) TABLESPACE pg_default
where
  (delivery_method in ('email', 'both') and (email_status = 'pending' or email_status is null));

create index IF not exists idx_notifications_delivery_method on public.notifications using btree (delivery_method, email_status) TABLESPACE pg_default;

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

-- Trigger to set email_sent_at when email_status changes to 'sent'
create or replace function set_email_sent_at()
returns trigger as $$
begin
  if new.email_status = 'sent' and (old.email_status is null or old.email_status != 'sent') then
    new.email_sent_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_set_email_sent_at
before update on notifications
for each row
execute function set_email_sent_at();

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
