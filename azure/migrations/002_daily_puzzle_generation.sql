-- Masquerade automatic daily puzzle generation.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists puzzle_generation_batches(
  id uuid primary key default gen_random_uuid(),

  target_date date not null,

  difficulty_band text not null
    check(difficulty_band in ('clever','devious','fiendish')),

  status text not null default 'pending'
    check(status in ('pending','generating','published','failed')),

  generator_model text,
  reviewer_model text,

  candidate_count int not null default 0,
  accepted_count int not null default 0,

  error_message text,

  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  unique(target_date, difficulty_band)
);

alter table puzzles
  add column if not exists source text not null default 'editorial';

alter table puzzles
  add column if not exists generation_batch_id uuid
    references puzzle_generation_batches(id)
    on delete set null;

alter table puzzles
  add column if not exists content_fingerprint text;

alter table puzzles
  add column if not exists review_score int;

alter table puzzles
  add column if not exists review_notes jsonb;

alter table puzzles
  add column if not exists scheduled_for date;

create unique index if not exists puzzles_content_fingerprint_uidx
  on puzzles(content_fingerprint)
  where content_fingerprint is not null;

create index if not exists puzzles_scheduled_for_idx
  on puzzles(scheduled_for);

create index if not exists puzzles_generation_batch_idx
  on puzzles(generation_batch_id);

create index if not exists puzzle_generation_batches_date_idx
  on puzzle_generation_batches(target_date);