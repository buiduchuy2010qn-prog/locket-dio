-- Optional Supabase/Postgres mirror for moment drafts (file store is primary).
-- Safe to run when SUPABASE is configured.

create table if not exists moment_drafts (
  id text primary key,
  owner_uid text not null,
  schema_version int default 4,
  revision int default 1,
  created_at bigint,
  updated_at bigint,
  deleted_at bigint,
  media_type text,
  caption text,
  caption_style jsonb,
  music jsonb,
  overlays jsonb,
  audience text,
  selected_friend_ids jsonb,
  options_data jsonb,
  status text,
  original_object_key text,
  active_object_key text,
  thumbnail_object_key text,
  mime_type text,
  file_name text,
  width int,
  height int,
  duration double precision,
  payload jsonb
);

create index if not exists moment_drafts_owner_updated
  on moment_drafts (owner_uid, updated_at desc);
