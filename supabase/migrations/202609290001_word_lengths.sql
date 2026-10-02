-- Preserve existing Words/Phrases attempts while allowing the new Words lengths.
-- The server enforces each room's selected length before scoring or persistence.
alter table public.guess_attempts drop constraint if exists guess_attempts_puzzle_check;
alter table public.guess_attempts add constraint guess_attempts_puzzle_check check (
  ((game = 'words' and word ~ '^[A-Z]{5,7}$') or
   (game = 'phrases' and word ~ '^[A-Z]{2,105}$'))
  and jsonb_typeof(marks) = 'array'
  and jsonb_array_length(marks) = char_length(word)
);
