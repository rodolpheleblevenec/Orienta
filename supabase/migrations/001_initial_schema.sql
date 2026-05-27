-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users ──────────────────────────────────────────
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            text UNIQUE NOT NULL,
  display_name     text NOT NULL,
  xp_contributed   int DEFAULT 0,
  streak_current   int DEFAULT 0,
  streak_best      int DEFAULT 0,
  last_played_at   timestamp,
  created_at       timestamp DEFAULT now()
);

-- ── word_cards ─────────────────────────────────────
CREATE TABLE word_cards (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_top    text NOT NULL,
  word_right  text NOT NULL,
  word_bottom text NOT NULL,
  word_left   text NOT NULL,
  difficulty  text CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  tags        text[],
  created_at  timestamp DEFAULT now()
);

-- ── grids ──────────────────────────────────────────
CREATE TABLE grids (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  status               text CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  clue_top             text,
  clue_right           text,
  clue_bottom          text,
  clue_left            text,
  creator_time_seconds int,
  created_at           timestamp DEFAULT now(),
  expires_at           timestamp
);

-- ── grid_cards (solution) ──────────────────────────
CREATE TABLE grid_cards (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  grid_id   uuid REFERENCES grids(id) ON DELETE CASCADE,
  card_id   uuid REFERENCES word_cards(id),
  position  int CHECK (position IN (0, 1, 2, 3)),
  rotation  int CHECK (rotation IN (0, 90, 180, 270))
);

-- ── plays ──────────────────────────────────────────
CREATE TABLE plays (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  grid_id        uuid REFERENCES grids(id) ON DELETE CASCADE,
  player_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  started_at     timestamp DEFAULT now(),
  completed_at   timestamp,
  time_seconds   int,
  attempts_count int CHECK (attempts_count BETWEEN 1 AND 3),
  success        boolean DEFAULT false,
  score          int DEFAULT 0,
  xp_earned      int DEFAULT 0,
  comment        text
);

-- ── play_attempts ──────────────────────────────────
CREATE TABLE play_attempts (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  play_id          uuid REFERENCES plays(id) ON DELETE CASCADE,
  attempt_number   int CHECK (attempt_number BETWEEN 1 AND 3),
  attempted_at     timestamp DEFAULT now(),
  answer           jsonb,
  correct_full     int,
  correct_rotation int,
  neither          int
);

-- ── collective_progress ────────────────────────────
CREATE TABLE collective_progress (
  id           int PRIMARY KEY DEFAULT 1,
  total_xp     int DEFAULT 0,
  level        int DEFAULT 1,
  level_name   text DEFAULT 'Naissance',
  updated_at   timestamp DEFAULT now()
);

INSERT INTO collective_progress (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Row Level Security ─────────────────────────────
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE grids              ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plays              ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE collective_progress ENABLE ROW LEVEL SECURITY;

-- Users: read all, update own
CREATE POLICY "users_read_all"   ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Word cards: read all (no auth needed for reading)
CREATE POLICY "word_cards_read_all" ON word_cards FOR SELECT USING (true);

-- Grids: read published grids, creators manage own
CREATE POLICY "grids_read_published" ON grids FOR SELECT
  USING (status = 'published' OR creator_id::text = auth.uid()::text);
CREATE POLICY "grids_insert_own" ON grids FOR INSERT
  WITH CHECK (creator_id::text = auth.uid()::text);
CREATE POLICY "grids_update_own" ON grids FOR UPDATE
  USING (creator_id::text = auth.uid()::text);

-- Grid cards (solution): ONLY readable after play is completed
CREATE POLICY "grid_cards_read_after_play" ON grid_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plays
      WHERE plays.grid_id = grid_cards.grid_id
        AND plays.player_id::text = auth.uid()::text
        AND plays.completed_at IS NOT NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM grids
      WHERE grids.id = grid_cards.grid_id
        AND grids.creator_id::text = auth.uid()::text
    )
  );
CREATE POLICY "grid_cards_insert_own" ON grid_cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grids WHERE grids.id = grid_id
        AND grids.creator_id::text = auth.uid()::text
    )
  );

-- Plays: own plays
CREATE POLICY "plays_read_own_or_creator" ON plays FOR SELECT
  USING (
    player_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM grids WHERE grids.id = plays.grid_id
        AND grids.creator_id::text = auth.uid()::text
    )
  );
CREATE POLICY "plays_insert_own" ON plays FOR INSERT
  WITH CHECK (player_id::text = auth.uid()::text);
CREATE POLICY "plays_update_own" ON plays FOR UPDATE
  USING (player_id::text = auth.uid()::text);

-- Play attempts: own
CREATE POLICY "attempts_insert_own" ON play_attempts FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM plays WHERE plays.id = play_id
      AND plays.player_id::text = auth.uid()::text)
  );
CREATE POLICY "attempts_read_own" ON play_attempts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM plays WHERE plays.id = play_id
      AND plays.player_id::text = auth.uid()::text)
  );

-- Collective progress: everyone reads
CREATE POLICY "collective_read_all" ON collective_progress FOR SELECT USING (true);
