-- Existing rooms default to Words. Keep the five-letter constraint for Words,
-- while allowing compact phrase letters plus one mark per playable character.
alter table public.guess_attempts add column if not exists game text not null default 'words';
alter table public.guess_attempts drop constraint if exists guess_attempts_word_check;
alter table public.guess_attempts drop constraint if exists guess_attempts_marks_check;
alter table public.guess_attempts drop constraint if exists guess_attempts_puzzle_check;
alter table public.guess_attempts add constraint guess_attempts_puzzle_check check (
  ((game = 'words' and word ~ '^[A-Z]{5}$') or
   (game = 'phrases' and word ~ '^[A-Z]{2,105}$'))
  and jsonb_typeof(marks) = 'array'
  and jsonb_array_length(marks) = char_length(word)
);
