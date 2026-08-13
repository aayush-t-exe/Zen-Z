-- ============================================
-- 0010_personality_answers_update_policy.sql
--
-- personality_answers had SELECT and INSERT policies for the answering
-- user, but no UPDATE policy. The quiz screen submits via
-- `.upsert(rows, { onConflict: 'user_id,question_id' })` — an
-- INSERT ... ON CONFLICT DO UPDATE. The first time through, every row is
-- a fresh insert and this works fine. The moment a user re-submits
-- (retried after an error, went back and changed an answer, ran the
-- quiz a second time), the conflict path needs to UPDATE the existing
-- row, and with no UPDATE policy present RLS denies it outright:
-- "new row violates row-level security policy for table
-- personality_answers". Mirrors the existing self-insert policy.
-- ============================================

create policy "self update own answers" on personality_answers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
