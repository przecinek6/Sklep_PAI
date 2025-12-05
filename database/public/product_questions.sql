-- Unified product questions table (questions + answers in one table)
create table public.product_questions (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  user_id uuid not null,
  parent_id uuid null, -- null = question, not null = answer
  content text not null,
  is_answered boolean not null default false, -- only for parent questions
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_questions_pkey primary key (id),
  constraint product_questions_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint product_questions_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE,
  constraint product_questions_parent_id_fkey foreign KEY (parent_id) references product_questions (id) on delete CASCADE
) TABLESPACE pg_default;

-- Indexes
create index IF not exists idx_product_questions_product_id on public.product_questions using btree (product_id) TABLESPACE pg_default;

create index IF not exists idx_product_questions_user_id on public.product_questions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_product_questions_parent_id on public.product_questions using btree (parent_id) TABLESPACE pg_default;

create index IF not exists idx_product_questions_unanswered on public.product_questions using btree (is_answered, created_at) TABLESPACE pg_default
where
  (is_answered = false and parent_id is null);

create index IF not exists idx_product_questions_root on public.product_questions using btree (product_id, created_at desc) TABLESPACE pg_default
where
  (parent_id is null);

-- Trigger to update parent question's is_answered status when answer is added
create or replace function update_question_answered_status()
returns trigger as $$
begin
  if new.parent_id is not null then
    update product_questions
    set is_answered = true
    where id = new.parent_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_question_answered
after insert on product_questions
for each row
when (new.parent_id is not null)
execute function update_question_answered_status();

create trigger update_product_questions_updated_at BEFORE
update on product_questions for EACH row
execute FUNCTION update_updated_at_column ();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS
alter table product_questions enable row level security;

-- Policy: Anyone can view questions and answers
create policy "Anyone can view questions and answers"
  on product_questions for select
  using (true);

-- Policy: Authenticated users can insert questions
create policy "Authenticated users can insert questions"
  on product_questions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can update their own questions
create policy "Users can update their own questions"
  on product_questions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own questions
create policy "Users can delete their own questions"
  on product_questions for delete
  to authenticated
  using (auth.uid() = user_id);