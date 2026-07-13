-- Optional Supabase/Postgres schema for music library
-- Apply when SUPABASE is configured.

CREATE TABLE IF NOT EXISTS music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  audio_url TEXT NOT NULL,
  duration DOUBLE PRECISION DEFAULT 0,
  cover_url TEXT DEFAULT '',
  source TEXT DEFAULT 'upload',
  is_public BOOLEAN DEFAULT true,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moment_music (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id TEXT NOT NULL,
  music_track_id UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  start_time DOUBLE PRECISION DEFAULT 0,
  end_time DOUBLE PRECISION DEFAULT 0,
  volume DOUBLE PRECISION DEFAULT 1,
  original_video_volume DOUBLE PRECISION DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_public ON music_tracks (is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_tracks_title ON music_tracks (title);
CREATE INDEX IF NOT EXISTS idx_moment_music_moment ON moment_music (moment_id);
