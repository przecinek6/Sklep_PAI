create table public.product_question_answers (
  id uuid not null default gen_random_uuid (),
  question_id uuid not null,
  user_id uuid not null,
  answer text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint product_question_answers_pkey primary key (id),
  constraint product_question_answers_question_id_fkey foreign KEY (question_id) references product_questions (id) on delete CASCADE,
  constraint product_question_answers_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_product_question_answers_question_id on public.product_question_answers using btree (question_id) TABLESPACE pg_default;

create index IF not exists idx_product_question_answers_user_id on public.product_question_answers using btree (user_id) TABLESPACE pg_default;

create trigger trigger_update_question_answered
after INSERT on product_question_answers for EACH row
execute FUNCTION update_question_answered_status ();

create trigger update_product_question_answers_updated_at BEFORE
update on product_question_answers for EACH row
execute FUNCTION update_updated_at_column ();