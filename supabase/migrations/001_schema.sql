-- =====================================================================
-- Welding Learner — 001_schema.sql
-- Tables, enums, triggers, unlock logic, and secure exam RPCs.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------------------------------------------------
create type public.user_role      as enum ('student', 'admin');
create type public.exam_type      as enum ('mcq', 'cq');
create type public.attempt_status as enum ('in_progress', 'awaiting_evaluation', 'completed');

-- ---------- profiles -------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now()
);

-- ---------- levels ---------------------------------------------------
create table public.levels (
  id            uuid primary key default gen_random_uuid(),
  level_number  smallint not null unique check (level_number between 1 and 4),
  title         text not null,
  description   text,
  pass_mark     numeric(5,2) not null default 80 check (pass_mark between 0 and 100),
  exam_size     smallint     not null default 50 check (exam_size > 0),
  created_at    timestamptz not null default now()
);

-- ---------- study_materials (accordion Q&A) ---------------------------
create table public.study_materials (
  id            uuid primary key default gen_random_uuid(),
  level_id      uuid not null references public.levels(id) on delete cascade,
  question      text not null,
  answer        text not null,
  sort_order    int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);
create index study_materials_level_idx on public.study_materials (level_id, sort_order);

-- ---------- questions_mcq (200+ per level) ---------------------------
create table public.questions_mcq (
  id              uuid primary key default gen_random_uuid(),
  level_id        uuid not null references public.levels(id) on delete cascade,
  question_text   text not null,
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  correct_option  char(1) not null check (correct_option in ('A','B','C','D')),
  explanation     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index questions_mcq_level_idx on public.questions_mcq (level_id) where is_active;

-- ---------- questions_cq (200+ per level) ----------------------------
create table public.questions_cq (
  id            uuid primary key default gen_random_uuid(),
  level_id      uuid not null references public.levels(id) on delete cascade,
  question_text text not null,
  model_answer  text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index questions_cq_level_idx on public.questions_cq (level_id) where is_active;

-- ---------- user_progress (one row per user per level) ----------------
create table public.user_progress (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  level_id        uuid not null references public.levels(id)   on delete cascade,
  mcq_best_score  numeric(5,2),
  cq_best_score   numeric(5,2),
  mcq_passed      boolean not null default false,
  cq_passed       boolean not null default false,
  mcq_attempts    int not null default 0,
  cq_attempts     int not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (user_id, level_id)
);

-- ---------- exam_attempts (snapshot of what the student was served) ---
create table public.exam_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  level_id         uuid not null references public.levels(id)   on delete cascade,
  exam_type        public.exam_type not null,
  status           public.attempt_status not null default 'in_progress',
  payload          jsonb not null,          -- questions served (NO answers)
  answers          jsonb,                   -- student's submitted answers
  score            numeric(5,2),
  correct_count    int,
  total_questions  int not null,
  passed           boolean,
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, level_id, started_at desc);

-- Answer keys live in a separate table that clients can never read.
create table public.exam_attempt_keys (
  attempt_id  uuid primary key references public.exam_attempts(id) on delete cascade,
  answer_key  jsonb not null
);

-- =====================================================================
-- Triggers
-- =====================================================================

-- New auth user -> profile (role is ALWAYS 'student'; never read from metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'student');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block role escalation by non-admins
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end $$;

-- =====================================================================
-- Helper functions
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Level 1 is always open. Level N (2-4) opens when BOTH MCQ and CQ of N-1 are passed.
create or replace function public.is_level_unlocked(p_level_number int)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or p_level_number <= 1
    or exists (
      select 1
      from public.user_progress up
      join public.levels l on l.id = up.level_id
      where up.user_id = auth.uid()
        and l.level_number = p_level_number - 1
        and up.mcq_passed and up.cq_passed
    );
$$;

-- Shuffles A-D for one MCQ. Returns {id, question, options:[{label,text}], correct}.
-- Internal only: not callable from the client.
create or replace function public.shuffle_mcq_options(q public.questions_mcq)
returns jsonb
language sql volatile as $$
  select jsonb_build_object(
    'id',       q.id,
    'question', q.question_text,
    'options',  jsonb_agg(jsonb_build_object('label', s.lbl, 'text', s.txt) order by s.lbl),
    'correct',  max(case when s.orig = q.correct_option then s.lbl end)
  )
  from (
    select v.orig, v.txt,
           chr(64 + (row_number() over (order by random()))::int) as lbl
    from (values ('A', q.option_a), ('B', q.option_b),
                 ('C', q.option_c), ('D', q.option_d)) as v(orig, txt)
  ) s;
$$;
revoke all on function public.shuffle_mcq_options(public.questions_mcq) from public, anon, authenticated;

-- =====================================================================
-- Exam RPCs (security definer: students never touch question tables)
-- =====================================================================

-- Start an exam: random 50 questions; MCQ options reshuffled every time.
create or replace function public.start_exam(p_level_number int, p_type public.exam_type)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_level   public.levels%rowtype;
  v_attempt uuid;
  v_payload jsonb;
  v_key     jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_level from public.levels where level_number = p_level_number;
  if not found then raise exception 'Level not found'; end if;
  if not public.is_level_unlocked(p_level_number) then
    raise exception 'Level % is locked', p_level_number;
  end if;

  if p_type = 'mcq' then
    with picked as (
      select public.shuffle_mcq_options(m) as item
      from public.questions_mcq m
      where m.level_id = v_level.id and m.is_active
      order by random()
      limit v_level.exam_size
    )
    select jsonb_agg(item - 'correct'),
           jsonb_object_agg(item->>'id', item->>'correct')
      into v_payload, v_key
      from picked;
  else
    with picked as (
      select c.id, c.question_text, c.model_answer
      from public.questions_cq c
      where c.level_id = v_level.id and c.is_active
      order by random()
      limit v_level.exam_size
    )
    select jsonb_agg(jsonb_build_object('id', id, 'question', question_text)),
           jsonb_object_agg(id::text, model_answer)
      into v_payload, v_key
      from picked;
  end if;

  if v_payload is null then raise exception 'No questions available for this level'; end if;

  insert into public.exam_attempts (user_id, level_id, exam_type, payload, total_questions)
  values (v_uid, v_level.id, p_type, v_payload, jsonb_array_length(v_payload))
  returning id into v_attempt;

  insert into public.exam_attempt_keys (attempt_id, answer_key) values (v_attempt, v_key);

  return jsonb_build_object('attempt_id', v_attempt, 'exam_type', p_type, 'questions', v_payload);
end $$;

-- MCQ: p_answers = {"<question_id>": "A" | "B" | "C" | "D", ...}
create or replace function public.submit_mcq_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_att     public.exam_attempts%rowtype;
  v_key     jsonb;
  v_total   int;
  v_correct int;
  v_score   numeric(5,2);
  v_pass    numeric;
  v_passed  boolean;
begin
  select * into v_att from public.exam_attempts
   where id = p_attempt_id and user_id = auth.uid()
     and exam_type = 'mcq' and status = 'in_progress'
   for update;
  if not found then raise exception 'Attempt not found or already submitted'; end if;

  select answer_key into v_key from public.exam_attempt_keys where attempt_id = p_attempt_id;
  p_answers := coalesce(p_answers, '{}'::jsonb);

  select count(*), count(*) filter (where p_answers->>k.key = k.value)
    into v_total, v_correct
    from jsonb_each_text(v_key) k;

  select pass_mark into v_pass from public.levels where id = v_att.level_id;
  v_score  := round(v_correct * 100.0 / v_total, 2);
  v_passed := v_score >= v_pass;

  update public.exam_attempts
     set status = 'completed', answers = p_answers, score = v_score,
         correct_count = v_correct, passed = v_passed, submitted_at = now()
   where id = p_attempt_id;

  insert into public.user_progress (user_id, level_id, mcq_best_score, mcq_passed, mcq_attempts)
  values (v_att.user_id, v_att.level_id, v_score, v_passed, 1)
  on conflict (user_id, level_id) do update set
    mcq_best_score = greatest(coalesce(public.user_progress.mcq_best_score, 0), excluded.mcq_best_score),
    mcq_passed     = public.user_progress.mcq_passed or excluded.mcq_passed,
    mcq_attempts   = public.user_progress.mcq_attempts + 1,
    updated_at     = now();

  return jsonb_build_object(
    'score', v_score, 'correct', v_correct, 'total', v_total,
    'passed', v_passed, 'correct_options', v_key
  );
end $$;

-- CQ step 1: p_answers = {"<question_id>": "typed answer", ...}
-- Returns student answers beside admin model answers for self/AI evaluation.
create or replace function public.submit_cq_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_att    public.exam_attempts%rowtype;
  v_key    jsonb;
  v_review jsonb;
begin
  select * into v_att from public.exam_attempts
   where id = p_attempt_id and user_id = auth.uid()
     and exam_type = 'cq' and status = 'in_progress'
   for update;
  if not found then raise exception 'Attempt not found or already submitted'; end if;

  select answer_key into v_key from public.exam_attempt_keys where attempt_id = p_attempt_id;
  p_answers := coalesce(p_answers, '{}'::jsonb);

  update public.exam_attempts
     set status = 'awaiting_evaluation', answers = p_answers, submitted_at = now()
   where id = p_attempt_id;

  select jsonb_agg(jsonb_build_object(
           'id', q.id,
           'question', q.question,
           'student_answer', coalesce(p_answers->>q.id, ''),
           'model_answer', v_key->>q.id))
    into v_review
    from jsonb_to_recordset(v_att.payload) as q(id text, question text);

  return jsonb_build_object('attempt_id', p_attempt_id, 'review', v_review);
end $$;

-- CQ step 2: record the evaluated percentage (self-assessed or AI-assessed).
-- NOTE: this is honor-based. For tamper-proof scoring, revoke this from
-- 'authenticated' and call it from an Edge Function (service role) that
-- grades with an LLM.
create or replace function public.finalize_cq_exam(p_attempt_id uuid, p_score numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_att    public.exam_attempts%rowtype;
  v_pass   numeric;
  v_passed boolean;
begin
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'Score must be between 0 and 100';
  end if;

  select * into v_att from public.exam_attempts
   where id = p_attempt_id and user_id = auth.uid()
     and exam_type = 'cq' and status = 'awaiting_evaluation'
   for update;
  if not found then raise exception 'Attempt not awaiting evaluation'; end if;

  select pass_mark into v_pass from public.levels where id = v_att.level_id;
  v_passed := p_score >= v_pass;

  update public.exam_attempts
     set status = 'completed', score = round(p_score, 2), passed = v_passed
   where id = p_attempt_id;

  insert into public.user_progress (user_id, level_id, cq_best_score, cq_passed, cq_attempts)
  values (v_att.user_id, v_att.level_id, round(p_score, 2), v_passed, 1)
  on conflict (user_id, level_id) do update set
    cq_best_score = greatest(coalesce(public.user_progress.cq_best_score, 0), excluded.cq_best_score),
    cq_passed     = public.user_progress.cq_passed or excluded.cq_passed,
    cq_attempts   = public.user_progress.cq_attempts + 1,
    updated_at    = now();

  return jsonb_build_object('score', round(p_score, 2), 'passed', v_passed);
end $$;

-- Dashboard helper: all 4 levels with lock state + progress in one call.
create or replace function public.get_dashboard()
returns table (
  level_number smallint, title text, description text, is_unlocked boolean,
  mcq_best_score numeric, cq_best_score numeric, mcq_passed boolean, cq_passed boolean
)
language sql stable security definer set search_path = public as $$
  select l.level_number, l.title, l.description,
         public.is_level_unlocked(l.level_number),
         up.mcq_best_score, up.cq_best_score,
         coalesce(up.mcq_passed, false), coalesce(up.cq_passed, false)
  from public.levels l
  left join public.user_progress up
         on up.level_id = l.id and up.user_id = auth.uid()
  order by l.level_number;
$$;

-- Function privileges
revoke all on function
  public.start_exam(int, public.exam_type),
  public.submit_mcq_exam(uuid, jsonb),
  public.submit_cq_exam(uuid, jsonb),
  public.finalize_cq_exam(uuid, numeric),
  public.get_dashboard(),
  public.is_level_unlocked(int),
  public.is_admin()
from public, anon;

grant execute on function
  public.start_exam(int, public.exam_type),
  public.submit_mcq_exam(uuid, jsonb),
  public.submit_cq_exam(uuid, jsonb),
  public.finalize_cq_exam(uuid, numeric),
  public.get_dashboard(),
  public.is_level_unlocked(int),
  public.is_admin()
to authenticated;

-- Attach role guard after is_admin() exists
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_profile_role();
