create table public.slider_templates (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  is_active boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint slider_templates_pkey primary key (id),
  constraint slider_templates_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_slider_templates_active on public.slider_templates using btree (is_active) TABLESPACE pg_default;

create trigger ensure_single_active_slider_template_trigger
after INSERT
or
update OF is_active on slider_templates for EACH row when (new.is_active = true)
execute FUNCTION ensure_single_active_slider_template ();

create trigger ensure_single_active_slider_trigger
after INSERT
or
update OF is_active on slider_templates for EACH row when (new.is_active = true)
execute FUNCTION ensure_single_active_slider ();

create trigger slider_template_updated_at_trigger BEFORE
update on slider_templates for EACH row
execute FUNCTION update_slider_template_updated_at ();

create trigger update_slider_templates_updated_at BEFORE
update on slider_templates for EACH row
execute FUNCTION update_updated_at_column ();