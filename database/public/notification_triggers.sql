-- ========================================
-- SQL TRIGGERS FOR AUTOMATIC NOTIFICATIONS
-- ========================================

-- 1. Notification when order status changes
-- ========================================
create or replace function notify_order_status_change()
returns trigger as $$
declare
  v_order_number varchar(50);
  v_status_label text;
  v_message text;
begin
  -- Only send notification if status actually changed
  if old.status is distinct from new.status then
    v_order_number := new.order_number;
    
    -- Determine status label and message
    case new.status
      when 'processing' then
        v_status_label := 'w realizacji';
        v_message := 'Twoje zamówienie #' || v_order_number || ' jest obecnie w trakcie realizacji.';
      when 'shipped' then
        v_status_label := 'wysłane';
        v_message := 'Twoje zamówienie #' || v_order_number || ' zostało wysłane.';
      when 'delivered' then
        v_status_label := 'dostarczone';
        v_message := 'Twoje zamówienie #' || v_order_number || ' zostało dostarczone. Możesz wystawić opinię o produktach.';
      when 'cancelled' then
        v_status_label := 'anulowane';
        v_message := 'Twoje zamówienie #' || v_order_number || ' zostało anulowane.';
      when 'refunded' then
        v_status_label := 'zwrócone';
        v_message := 'Zwrot dla zamówienia #' || v_order_number || ' został zrealizowany.';
      else
        return new;
    end case;

    -- Insert notification
    insert into notifications (
      user_id,
      notification_type,
      title,
      message,
      link,
      metadata
    ) values (
      new.user_id,
      case 
        when new.status = 'cancelled' then 'order_cancelled'
        else 'order_status'
      end,
      'Status zamówienia: ' || v_status_label,
      v_message,
      '/orders',
      jsonb_build_object(
        'order_id', new.id,
        'order_number', new.order_number,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trigger_notify_order_status_change
after update on orders
for each row
execute function notify_order_status_change();


-- 2. Notification when payment status changes
-- ========================================
create or replace function notify_payment_status_change()
returns trigger as $$
declare
  v_order_number varchar(50);
  v_message text;
begin
  -- Only send notification if payment status changed
  if old.payment_status is distinct from new.payment_status then
    v_order_number := new.order_number;
    
    case new.payment_status
      when 'paid' then
        insert into notifications (
          user_id,
          notification_type,
          title,
          message,
          link,
          metadata
        ) values (
          new.user_id,
          'payment_success',
          'Płatność potwierdzona',
          'Płatność za zamówienie #' || v_order_number || ' została potwierdzona.',
          '/orders',
          jsonb_build_object(
            'order_id', new.id,
            'order_number', new.order_number,
            'payment_status', new.payment_status
          )
        );
      when 'failed' then
        insert into notifications (
          user_id,
          notification_type,
          title,
          message,
          link,
          metadata
        ) values (
          new.user_id,
          'payment_failed',
          'Płatność nieudana',
          'Płatność za zamówienie #' || v_order_number || ' nie powiodła się. Spróbuj ponownie.',
          '/orders',
          jsonb_build_object(
            'order_id', new.id,
            'order_number', new.order_number,
            'payment_status', new.payment_status
          )
        );
      else
        -- Do nothing for other statuses
        null;
    end case;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trigger_notify_payment_status_change
after update on orders
for each row
execute function notify_payment_status_change();


-- 3. Notification when review is approved or rejected
-- ========================================
create or replace function notify_review_moderation()
returns trigger as $$
declare
  v_product_name varchar(255);
begin
  -- Only send notification when approval status changes
  if old.is_approved is distinct from new.is_approved then
    -- Get product name
    select name into v_product_name
    from products
    where id = new.product_id;

    if new.is_approved = true then
      -- Review approved
      insert into notifications (
        user_id,
        notification_type,
        title,
        message,
        link,
        metadata
      ) values (
        new.user_id,
        'review_approved',
        'Opinia zatwierdzona',
        'Twoja opinia o produkcie "' || v_product_name || '" została zatwierdzona i jest teraz widoczna.',
        '/product/' || (select slug from products where id = new.product_id),
        jsonb_build_object(
          'review_id', new.id,
          'product_id', new.product_id,
          'product_name', v_product_name
        )
      );
    end if;
    -- Note: We don't notify on rejection as per requirements
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trigger_notify_review_moderation
after update on product_reviews
for each row
execute function notify_review_moderation();


-- 4. Notification when question is answered
-- ========================================
create or replace function notify_question_answered()
returns trigger as $$
declare
  v_question_user_id uuid;
  v_product_name varchar(255);
begin
  -- Get the user who asked the question and product name
  select pq.user_id, p.name
  into v_question_user_id, v_product_name
  from product_questions pq
  join products p on p.id = pq.product_id
  where pq.id = new.question_id;

  -- Insert notification for the question author
  insert into notifications (
    user_id,
    notification_type,
    title,
    message,
    link,
    metadata
  ) values (
    v_question_user_id,
    'question_answered',
    'Odpowiedź na Twoje pytanie',
    'Otrzymałeś odpowiedź na pytanie dotyczące produktu "' || v_product_name || '".',
    '/product/' || (
      select slug from products p 
      join product_questions pq on pq.product_id = p.id 
      where pq.id = new.question_id
    ),
    jsonb_build_object(
      'answer_id', new.id,
      'question_id', new.question_id,
      'product_name', v_product_name
    )
  );

  return new;
end;
$$ language plpgsql;

create trigger trigger_notify_question_answered
after insert on product_question_answers
for each row
execute function notify_question_answered();


-- 5. Notification when moderator responds to a report
-- ========================================
create or replace function notify_report_response()
returns trigger as $$
declare
  v_report_user_id uuid;
  v_product_name varchar(255);
begin
  -- Only send notification if sender is moderator or admin
  if new.sender_role = 'moderator' or new.sender_role = 'admin' then
    -- Get the user who created the report and product name
    select pr.user_id, p.name
    into v_report_user_id, v_product_name
    from product_reports pr
    join products p on p.id = pr.product_id
    where pr.id = new.report_id;

    -- Insert notification for the report author
    insert into notifications (
      user_id,
      notification_type,
      title,
      message,
      link,
      metadata
    ) values (
      v_report_user_id,
      'report_response',
      'Odpowiedź na zgłoszenie',
      'Otrzymałeś odpowiedź moderatora na zgłoszenie dotyczące produktu "' || v_product_name || '".',
      '/product/' || (
        select slug from products p 
        join product_reports pr on pr.product_id = p.id 
        where pr.id = new.report_id
      ),
      jsonb_build_object(
        'message_id', new.id,
        'report_id', new.report_id,
        'product_name', v_product_name
      )
    );
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trigger_notify_report_response
after insert on report_messages
for each row
execute function notify_report_response();


-- ========================================
-- UTILITY: Function to create custom notification
-- ========================================
-- This function can be called from application code to create custom notifications

create or replace function create_notification(
  p_user_id uuid,
  p_notification_type varchar(50),
  p_title varchar(255),
  p_message text,
  p_link varchar(500) default null,
  p_metadata jsonb default null
)
returns uuid as $$
declare
  v_notification_id uuid;
begin
  insert into notifications (
    user_id,
    notification_type,
    title,
    message,
    link,
    metadata
  ) values (
    p_user_id,
    p_notification_type,
    p_title,
    p_message,
    p_link,
    p_metadata
  )
  returning id into v_notification_id;
  
  return v_notification_id;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function create_notification to authenticated;


-- ========================================
-- CLEANUP: Delete old read notifications (optional)
-- ========================================
-- This can be run periodically to clean up old notifications

create or replace function cleanup_old_notifications()
returns void as $$
begin
  delete from notifications
  where is_read = true
    and read_at < now() - interval '90 days';
end;
$$ language plpgsql;

-- Optional: Create a scheduled job to run this cleanup
-- This would need to be set up in Supabase dashboard or using pg_cron extension
