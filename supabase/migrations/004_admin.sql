-- =====================================================================
-- Welding Learner — 004_admin.sql
-- Admin panel support: profile email, student overview, atomic CSV import.
-- =====================================================================

-- ---------- Email on profiles (so admins can identify students) -------
alter table public.profiles add column if not exists email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, 'student');
  return new;
end $$;

-- Non-admins can't change their own role or email.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role  is distinct from old.role  then raise exception 'Only admins can change roles'; end if;
    if new.email is distinct from old.email then raise exception 'Email cannot be changed here'; end if;
  end if;
  return new;
end $$;

-- ---------- Student overview (one row per student) --------------------
create or replace function public.admin_student_overview()
returns table (
  id uuid, full_name text, email text, created_at timestamptz,
  levels_cleared int, total_attempts int, last_active timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.full_name, p.email, p.created_at,
         (select count(*)::int from public.user_progress up
           where up.user_id = p.id and up.mcq_passed and up.cq_passed),
         (select count(*)::int from public.exam_attempts ea where ea.user_id = p.id),
         (select max(ea.started_at) from public.exam_attempts ea where ea.user_id = p.id)
  from public.profiles p
  where p.role = 'student'
  order by p.created_at desc;
end $$;

-- ---------- Atomic bulk import (all rows or nothing) -------------------
-- Rows already in the bank (same level + same question text) are skipped,
-- so re-uploading a file is safe.
create or replace function public.admin_import_mcq(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bad int; v_ins int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  select count(*) into v_bad
    from jsonb_to_recordset(p_rows) as r(level int)
    left join public.levels l on l.level_number = r.level
   where l.id is null;
  if v_bad > 0 then raise exception '% row(s) reference a level that does not exist', v_bad; end if;

  insert into public.questions_mcq
    (level_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
  select distinct on (l.id, btrim(r.question_text))
         l.id, btrim(r.question_text), btrim(r.option_a), btrim(r.option_b),
         btrim(r.option_c), btrim(r.option_d), upper(btrim(r.correct_option)),
         nullif(btrim(coalesce(r.explanation, '')), '')
    from jsonb_to_recordset(p_rows) as r(
           level int, question_text text, option_a text, option_b text,
           option_c text, option_d text, correct_option text, explanation text)
    join public.levels l on l.level_number = r.level
   where not exists (
           select 1 from public.questions_mcq q
            where q.level_id = l.id and q.question_text = btrim(r.question_text));
  get diagnostics v_ins = row_count;

  return jsonb_build_object('inserted', v_ins, 'skipped', jsonb_array_length(p_rows) - v_ins);
end $$;

create or replace function public.admin_import_cq(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bad int; v_ins int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;

  select count(*) into v_bad
    from jsonb_to_recordset(p_rows) as r(level int)
    left join public.levels l on l.level_number = r.level
   where l.id is null;
  if v_bad > 0 then raise exception '% row(s) reference a level that does not exist', v_bad; end if;

  insert into public.questions_cq (level_id, question_text, model_answer)
  select distinct on (l.id, btrim(r.question_text))
         l.id, btrim(r.question_text), btrim(r.model_answer)
    from jsonb_to_recordset(p_rows) as r(level int, question_text text, model_answer text)
    join public.levels l on l.level_number = r.level
   where not exists (
           select 1 from public.questions_cq q
            where q.level_id = l.id and q.question_text = btrim(r.question_text));
  get diagnostics v_ins = row_count;

  return jsonb_build_object('inserted', v_ins, 'skipped', jsonb_array_length(p_rows) - v_ins);
end $$;

revoke all on function
  public.admin_student_overview(),
  public.admin_import_mcq(jsonb),
  public.admin_import_cq(jsonb)
from public, anon;
grant execute on function
  public.admin_student_overview(),
  public.admin_import_mcq(jsonb),
  public.admin_import_cq(jsonb)
to authenticated;
