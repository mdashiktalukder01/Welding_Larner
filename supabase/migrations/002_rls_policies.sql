-- =====================================================================
-- Welding Learner — 002_rls_policies.sql
-- Students read only what they're allowed to; question banks and answer
-- keys are reachable only through the security-definer RPCs.
-- =====================================================================

alter table public.profiles           enable row level security;
alter table public.levels             enable row level security;
alter table public.study_materials    enable row level security;
alter table public.questions_mcq      enable row level security;
alter table public.questions_cq       enable row level security;
alter table public.user_progress      enable row level security;
alter table public.exam_attempts      enable row level security;
alter table public.exam_attempt_keys  enable row level security;

-- ---------- profiles --------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own (role guarded by trigger)"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---------- levels ----------------------------------------------------
create policy "levels: everyone signed in can read"
  on public.levels for select to authenticated
  using (true);

create policy "levels: admin manage"
  on public.levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- study_materials -------------------------------------------
-- Students see published items only for levels they have unlocked.
create policy "study: read if level unlocked"
  on public.study_materials for select to authenticated
  using (
    public.is_admin()
    or (
      is_published
      and exists (
        select 1 from public.levels l
        where l.id = study_materials.level_id
          and public.is_level_unlocked(l.level_number)
      )
    )
  );

create policy "study: admin manage"
  on public.study_materials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- questions_mcq / questions_cq (admin only) -----------------
-- No student policies: students get questions via start_exam() only,
-- so correct answers and model answers can never be selected directly.
create policy "mcq: admin only"
  on public.questions_mcq for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cq: admin only"
  on public.questions_cq for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- user_progress ---------------------------------------------
-- Read-only for students; written exclusively by the exam RPCs.
create policy "progress: read own or admin"
  on public.user_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- exam_attempts ---------------------------------------------
create policy "attempts: read own or admin"
  on public.exam_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------- exam_attempt_keys -----------------------------------------
-- Intentionally NO policies: unreachable from the client API.

-- Defense in depth: strip default table privileges for writes.
revoke insert, update, delete on public.user_progress     from authenticated, anon;
revoke insert, update, delete on public.exam_attempts     from authenticated, anon;
revoke all                    on public.exam_attempt_keys from authenticated, anon;
revoke all                    on public.questions_mcq     from anon;
revoke all                    on public.questions_cq      from anon;
