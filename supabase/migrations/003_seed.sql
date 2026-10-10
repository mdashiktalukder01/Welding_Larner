-- =====================================================================
-- Welding Learner — 003_seed.sql
-- Levels + a few sample rows. Replace/extend with your real 200+ pool.
-- (Runs as the migration owner, so RLS does not block it.)
-- =====================================================================

-- ---------- Levels (rename titles as you like) ------------------------
insert into public.levels (level_number, title, description) values
  (1, 'Level 1 — Welding Fundamentals & Safety', 'Basics of welding, PPE and workshop safety.'),
  (2, 'Level 2 — Welding Processes & Equipment',  'SMAW, MIG/MAG, TIG, gas welding and equipment.'),
  (3, 'Level 3 — Joints, Positions & Techniques', 'Joint types, welding positions and technique.'),
  (4, 'Level 4 — Inspection, Defects & Standards','Weld defects, testing and quality standards.')
on conflict (level_number) do nothing;

-- ---------- Sample study material (Level 1) ---------------------------
insert into public.study_materials (level_id, question, answer, sort_order)
select l.id, v.q, v.a, v.o
from public.levels l,
     (values
       ('What is welding?',
        'Welding is a process of joining two or more metal pieces by heat, pressure, or both, with or without filler metal, to form a permanent joint.', 1),
       ('Why is PPE important in welding?',
        'PPE (helmet with correct shade lens, gloves, flame-resistant clothing, safety boots) protects against arc radiation, sparks, spatter and burns.', 2)
     ) as v(q, a, o)
where l.level_number = 1;

-- ---------- Sample MCQs (Level 1) -------------------------------------
insert into public.questions_mcq
  (level_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select l.id, v.q, v.a, v.b, v.c, v.d, v.ans, v.ex
from public.levels l,
     (values
       ('Which radiation from the welding arc damages unprotected eyes?',
        'Ultraviolet', 'Radio waves', 'Sound waves', 'Gamma only', 'A',
        'The arc emits UV and IR radiation that can cause arc eye.'),
       ('Which of these is NOT standard welding PPE?',
        'Welding helmet', 'Leather gloves', 'Canvas sandals', 'Flame-resistant jacket', 'C',
        'Open footwear exposes feet to sparks and molten metal.'),
       ('What does SMAW stand for?',
        'Shielded Metal Arc Welding', 'Simple Metal Arc Work', 'Static Metal Arc Weld', 'Submerged Metal Arc Welding', 'A',
        'SMAW is also called stick welding.')
     ) as v(q, a, b, c, d, ans, ex)
where l.level_number = 1;

-- ---------- Sample CQs (Level 1) --------------------------------------
insert into public.questions_cq (level_id, question_text, model_answer)
select l.id, v.q, v.a
from public.levels l,
     (values
       ('Define welding and name two advantages over riveting.',
        'Welding joins metals permanently using heat and/or pressure. Advantages: stronger, leak-proof joints and lower weight/material use compared with riveting.'),
       ('List four safety precautions before starting an arc welding job.',
        'Wear proper PPE; check cables and earth clamp; remove flammables from the area; ensure ventilation and keep a fire extinguisher nearby.')
     ) as v(q, a)
where l.level_number = 1;

-- ---------------------------------------------------------------------
-- DEV ONLY: bulk placeholder rows to test 50-of-200 randomization.
-- Uncomment, run once, and delete these rows before going live
-- (they're tagged with "[DEV]").
-- ---------------------------------------------------------------------
-- insert into public.questions_mcq
--   (level_id, question_text, option_a, option_b, option_c, option_d, correct_option)
-- select l.id, '[DEV] L' || l.level_number || ' MCQ #' || g,
--        'Option A', 'Option B', 'Option C', 'Option D',
--        (array['A','B','C','D'])[1 + (g % 4)]
-- from public.levels l, generate_series(1, 200) g;
--
-- insert into public.questions_cq (level_id, question_text, model_answer)
-- select l.id, '[DEV] L' || l.level_number || ' CQ #' || g, 'Model answer ' || g
-- from public.levels l, generate_series(1, 200) g;
--
-- Cleanup:
-- delete from public.questions_mcq where question_text like '[DEV]%';
-- delete from public.questions_cq  where question_text like '[DEV]%';

-- ---------------------------------------------------------------------
-- Make yourself admin (run once after you register in the app):
-- update public.profiles set role = 'admin'
--  where id = (select id from auth.users where email = 'you@example.com');
-- ---------------------------------------------------------------------
