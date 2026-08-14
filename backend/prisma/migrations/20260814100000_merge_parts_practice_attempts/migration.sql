-- Fold `parts.practiceAttempts` into `parts.quizzes.forklift`.
--
-- When the practice quiz was merged into QuizQuestion, Forklift's attempts were
-- left under their original key so existing learners kept their scores, while
-- every other equipment wrote to `parts.quizzes[equipmentId]`. That left an
-- `equipmentId === 'forklift'` branch in both the reader (progressService) and
-- the writer (grading.js) for one table's worth of history. Moving the data
-- once removes both.
--
-- Attempts are newest-first in these lists, and the per-equipment list only
-- ever received attempts written after the split, so the legacy ones append.

-- `quizzes` may be missing entirely on snapshots written before the split;
-- jsonb_set cannot create a nested path through a key that does not exist.
UPDATE "ProgressSnapshot"
SET data = jsonb_set(data, '{parts,quizzes}', '{}'::jsonb, true)
WHERE data -> 'parts' IS NOT NULL
  AND NOT (data -> 'parts' ? 'quizzes');

UPDATE "ProgressSnapshot"
SET data = jsonb_set(
    data,
    '{parts,quizzes,forklift}',
    COALESCE(data -> 'parts' -> 'quizzes' -> 'forklift', '[]'::jsonb)
      || COALESCE(data -> 'parts' -> 'practiceAttempts', '[]'::jsonb),
    true
)
WHERE jsonb_typeof(data -> 'parts' -> 'practiceAttempts') = 'array'
  AND jsonb_array_length(data -> 'parts' -> 'practiceAttempts') > 0;

-- Drop the key everywhere, including the snapshots whose list was empty.
UPDATE "ProgressSnapshot"
SET data = data #- '{parts,practiceAttempts}'
WHERE data -> 'parts' ? 'practiceAttempts';
