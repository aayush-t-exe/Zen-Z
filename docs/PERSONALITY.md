# Personality System Architecture

The personality system is fully data-driven and extensible. Questions, dimensions, and scoring rules live entirely in the database — adding questions requires zero frontend or backend code changes.

## System Overview

1. **Student takes quiz** → `personality-quiz.tsx` fetches questions from DB
2. **Answers saved** → `personality_answers` table stores raw responses
3. **Scoring function triggered** → Edge Function aggregates into `personality_scores`
4. **Scores used for matching** → Admin dashboard and matching engine access scores

## Database Schema

### `personality_dimensions`
Traits being measured (e.g., "Adventurous", "Social").

```sql
id (serial PK)
key (text, unique) -- e.g. 'adventurous', 'social'
label (text) -- e.g. 'Adventurous', 'Social'
created_at (timestamptz)
```

### `personality_questions`
The actual quiz questions.

```sql
id (serial PK)
prompt (text) -- The question text
question_type (enum: 'single_select' | 'multi_select' | 'scale')
display_order (int) -- Order in quiz
is_active (boolean) -- Hide question without deleting
created_at (timestamptz)
```

### `personality_question_options`
Choices for single/multi-select questions.

```sql
id (serial PK)
question_id (int FK) -- Which question this belongs to
label (text) -- The choice text
display_order (int) -- Order options appear
```

### `personality_option_weights`
Maps each option to how much it contributes to each dimension.

```sql
option_id (int FK)
dimension_id (int FK)
weight (numeric) -- Usually -1 to +1 (can be outside)
```

**Example:** Option "Go with the flow" might have:
- `weight: 0.8` toward Adventurous
- `weight: 0.6` toward Chill

### `personality_scale_mappings`
For scale questions (1-10), maps the raw value to a dimension.

```sql
question_id (int FK)
dimension_id (int FK)
multiplier (numeric, default 1) -- Scale value × multiplier = contribution
```

**Example:** Scale question for adventurousness might have:
- `dimension_id: 1` (Adventurous)
- `multiplier: 1` (so 1-10 maps 1:1 to Adventurous)

### `personality_answers`
Raw user responses.

```sql
id (uuid PK)
user_id (uuid FK) -- Which student
question_id (int FK) -- Which question
selected_option_ids (int[]) -- For select types
scale_value (numeric) -- For scale types
created_at (timestamptz)
unique (user_id, question_id) -- One answer per student per question
```

### `personality_scores`
Computed personality profile (updated by scoring function).

```sql
user_id (uuid FK)
dimension_id (int FK)
score (numeric) -- 0-1 normalized
updated_at (timestamptz)
```

## How Scoring Works

The `score-personality` Edge Function:

1. Fetches all `personality_answers` for a user
2. For each answer:
   - If it's a select type: looks up `personality_option_weights` for those options
   - If it's a scale type: looks up `personality_scale_mappings` and multiplies
3. Aggregates per dimension: `sum / count`
4. Normalizes to 0-1 range with `Math.min(1, Math.max(0, ...))`
5. Upserts into `personality_scores`

**Result:** Each dimension gets a 0-1 score reflecting how much the user exhibits that trait.

## How to Add a Question

No code changes needed. Just insert into the database:

```sql
-- Add a new question
insert into personality_questions (prompt, question_type, display_order, is_active)
values (
  'When meeting new people, you usually...',
  'single_select',
  6, -- display order (after the existing 5)
  true
);

-- Add options (get the new question's ID first)
insert into personality_question_options (question_id, label, display_order)
values
  (6, 'Start a conversation', 1),
  (6, 'Wait for them to approach', 2),
  (6, 'Stick with your friend group', 3);

-- Map options to dimensions (get option IDs: 19, 20, 21)
insert into personality_option_weights (option_id, dimension_id, weight)
values
  (19, 2, 0.9),  -- "Start conversation" → Social (+0.9)
  (20, 2, -0.5), -- "Wait to approach" → not very Social (-0.5)
  (21, 2, -0.7); -- "Stick with group" → not very Social (-0.7)
```

After inserting, the quiz automatically renders the new question. No frontend rebuild needed.

## How to Add a Dimension

```sql
insert into personality_dimensions (key, label)
values ('reliable', 'Reliable');

-- Map existing questions to this new dimension if desired
insert into personality_scale_mappings (question_id, dimension_id, multiplier)
values (3, 5, 0.5); -- Question 3 partially contributes to Reliable
```

Once scores are computed for this dimension, it appears in the admin matching dashboard automatically.

## Frontend: The Quiz Screen

`apps/mobile/src/app/(auth)/personality-quiz.tsx`

**What it does:**
- On mount, fetches all active questions with their options
- Renders question based on `question_type`:
  - **single_select**: Radio button list
  - **scale**: 1-10 number pad
  - **multi_select**: Checkboxes (not yet used in initial questions)
- Progress bar shows position
- Back/Next/Complete buttons
- Validates all questions answered before allowing completion
- On Complete: upserts answers, calls `score-personality`, routes to home

**How it scales:**
- Works with 5 questions or 50+
- Fetches questions dynamically, so UI auto-updates as you add questions
- Progress bar auto-adjusts to `questions.length`

## Backend: The Scoring Function

`supabase/functions/score-personality/index.ts` (Deno runtime)

**Invoked by:**
```typescript
// After saving all answers
supabase.functions.invoke('score-personality', { body: { user_id } });
```

**What it does:**
1. Fetches all answers for the user from `personality_answers`
2. For select-type answers: sums weights from `personality_option_weights`
3. For scale-type answers: multiplies raw value by `personality_scale_mappings.multiplier`
4. Groups by dimension, averages (`sum / count`)
5. Normalizes to 0-1
6. Upserts into `personality_scores`

**Why it's an Edge Function:**
- Keeps scoring logic on the backend (not exposed to client)
- Can access service role (bypasses RLS for reading/writing scores)
- Scales horizontally with Supabase infrastructure

## How Matching Uses Scores

The matching engine (Edge Function, Milestone 14) will:

1. Query `admin_students_with_personality` view → gets all users + scores
2. For each pair of students, compute cosine similarity across all dimensions
3. Group students into compatible groups of 4-5

The matching algorithm doesn't care how many dimensions exist — it works with whatever scores are in `personality_scores`.

## RLS & Privacy

- Students can only read their own `personality_answers` and `personality_scores`
- Admins can read all
- Scores are never visible to the mobile app until the founder creates a group (then only groupmate info, not raw scores)

## Testing the System

```sql
-- Check questions were seeded
select id, prompt, question_type from personality_questions;

-- After a student completes quiz, check answers
select * from personality_answers where user_id = 'user-uuid';

-- Check computed scores
select * from personality_scores where user_id = 'user-uuid';

-- Verify dimensions and their labels
select id, key, label from personality_dimensions;
```

## Extending Further

**Ideas for expansion:**
- Add more dimensions (Optimism, Conscientiousness, etc.)
- Add follow-up questions that branch based on answers
- Re-run scoring weekly and show students how their personality evolves
- Export personality profiles as shareable "trait cards"
- Use scores for referral matching ("invite friends who would match you")

All of these work without modifying `personality-quiz.tsx` or `score-personality` — just database changes.
