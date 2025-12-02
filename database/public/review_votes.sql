create table public.review_votes (
  id uuid not null default gen_random_uuid (),
  review_id uuid not null,
  user_id uuid not null,
  vote_type public.vote_type not null,
  created_at timestamp with time zone not null default now(),
  constraint review_votes_pkey primary key (id),
  constraint review_votes_unique unique (review_id, user_id),
  constraint review_votes_review_id_fkey foreign KEY (review_id) references product_reviews (id) on delete CASCADE,
  constraint review_votes_user_id_fkey foreign KEY (user_id) references user_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_review_votes_review_id on public.review_votes using btree (review_id) TABLESPACE pg_default;

create index IF not exists idx_review_votes_user_id on public.review_votes using btree (user_id) TABLESPACE pg_default;

create trigger trigger_update_review_vote_counts
after INSERT
or DELETE
or
update on review_votes for EACH row
execute FUNCTION update_review_vote_counts ();