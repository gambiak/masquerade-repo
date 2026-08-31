-- Masquerade staged puzzle generation.
-- Persists generated candidates between short-lived HTTP requests.
-- Safe to run more than once.

create table if not exists puzzle_generation_candidates (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references puzzle_generation_batches(id)
    on delete cascade,

  candidate_id text not null,

  clue_type text not null
    check (clue_type in (
      'word',
      'rebus',
      'pattern',
      'logic',
      'math'
    )),

  clue_text text not null,

  answer text not null,

  accepted_answers text[] not null
    default '{}',

  numeric_answer boolean not null
    default false,

  difficulty_score int not null,

  hint_1 text not null,
  hint_2 text not null,
  hint_3 text not null,

  explanation text not null,

  content_fingerprint text not null,

  review_status text not null
    default 'pending'
    check (
      review_status in (
        'pending',
        'approved',
        'rejected'
      )
    ),

  review_score int,

  review_notes jsonb,

  created_at timestamptz not null
    default now(),

  reviewed_at timestamptz,

  unique(batch_id, candidate_id),
  unique(batch_id, content_fingerprint)
);

create index if not exists
  puzzle_generation_candidates_batch_idx
on puzzle_generation_candidates(batch_id);

create index if not exists
  puzzle_generation_candidates_review_idx
on puzzle_generation_candidates(
  batch_id,
  review_status
);