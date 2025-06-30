-- Lifeboard Database Initialization Script

-- Extensions (if needed, though UUID is standard)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === Limitless Data Tables ===

-- Main lifelog entries from Limitless
CREATE TABLE limitless_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limitless_id VARCHAR(255) UNIQUE NOT NULL, -- ID from the Limitless API
    title TEXT,
    markdown_content TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER set_limitless_entries_timestamp
BEFORE UPDATE ON limitless_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Content nodes for structured data within Limitless entries (e.g., transcriptions, actions)
CREATE TABLE limitless_content_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES limitless_entries(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES limitless_content_nodes(id) ON DELETE CASCADE, -- For nested structures
    node_type VARCHAR(50) NOT NULL, -- e.g., 'transcription', 'summary', 'action_item'
    content TEXT,
    start_time TIMESTAMP WITH TIME ZONE, -- Relative to entry or absolute
    end_time TIMESTAMP WITH TIME ZONE,   -- Relative to entry or absolute
    start_offset_ms INTEGER, -- Offset from the start of the parent entry/node
    end_offset_ms INTEGER,
    speaker_name VARCHAR(255),
    speaker_identifier VARCHAR(50), -- e.g., 'SPEAKER_01'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- No updated_at here as these are typically immutable parts of an entry
);

-- === Bee.computer Data Tables ===

-- Bee conversations
CREATE TABLE bee_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bee_id BIGINT UNIQUE NOT NULL, -- ID from Bee.computer API
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    device_type VARCHAR(50), -- e.g., 'pendant', 'mobile_app'
    summary TEXT,
    short_summary TEXT,
    state VARCHAR(50), -- e.g., 'completed', 'processing'
    primary_location JSONB, -- Store as JSON, e.g., { "latitude": ..., "longitude": ..., "address": "..." }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER set_bee_conversations_timestamp
BEFORE UPDATE ON bee_conversations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Utterances within Bee conversations
CREATE TABLE bee_utterances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES bee_conversations(id) ON DELETE CASCADE,
    bee_utterance_id BIGINT NOT NULL, -- ID from Bee.computer API, may not be unique across all utterances
    speaker VARCHAR(10) NOT NULL, -- 'user' or 'assistant' or 'SPEAKER_XX'
    text TEXT NOT NULL,
    start_seconds DECIMAL(10,2), -- Relative to conversation start
    end_seconds DECIMAL(10,2),   -- Relative to conversation start
    spoken_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Absolute timestamp of utterance
    is_realtime BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (conversation_id, bee_utterance_id) -- Ensure utterance ID is unique within a conversation
);

-- Bee facts
CREATE TABLE bee_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bee_id BIGINT UNIQUE NOT NULL, -- ID from Bee.computer API
    content TEXT NOT NULL,
    is_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- If facts can be updated
);
CREATE TRIGGER set_bee_facts_timestamp
BEFORE UPDATE ON bee_facts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


-- Bee todos
CREATE TABLE bee_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bee_id BIGINT UNIQUE NOT NULL, -- ID from Bee.computer API
    text TEXT NOT NULL,
    alarm_at TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER set_bee_todos_timestamp
BEFORE UPDATE ON bee_todos
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Bee locations (if separate from conversation primary_location)
-- As per dev spec, this seems to be a distinct entity.
CREATE TABLE bee_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bee_id BIGINT UNIQUE NOT NULL, -- ID from Bee.computer API
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- When this location was recorded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- No updated_at; location records are typically immutable snapshots.
);


-- === Supporting Tables ===

-- Weather data
CREATE TABLE weather_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL, -- e.g., "New York, NY" or specific lat/lon for which weather was fetched
    temperature_high INTEGER,
    temperature_low INTEGER,
    condition VARCHAR(100), -- e.g., "Sunny", "Cloudy"
    description TEXT,       -- e.g., "Clear sky"
    humidity INTEGER,       -- Percentage
    icon_code VARCHAR(10),  -- Weather API icon code e.g. "01d"
    sunrise TIMESTAMP WITH TIME ZONE,
    sunset TIMESTAMP WITH TIME ZONE,
    data JSONB,             -- Store raw API response for future use or more details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (date, location) -- Assuming one weather entry per location per day
);

-- Mood tracking
CREATE TABLE mood_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- For future multi-user support, for now can be NULL or a default value
    date DATE NOT NULL,
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10), -- Or whatever scale
    mood_text VARCHAR(50),  -- Optional short text, e.g., "Happy", "Tired"
    notes TEXT,             -- Longer reflections or notes about the mood
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- When the mood was actually recorded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date) -- Assuming one mood entry per user per day
);
CREATE TRIGGER set_mood_entries_timestamp
BEFORE UPDATE ON mood_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Daily aggregations for performance and quick calendar view
CREATE TABLE daily_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    user_id UUID, -- For future multi-user support
    has_limitless_data BOOLEAN DEFAULT FALSE,
    has_bee_data BOOLEAN DEFAULT FALSE,
    has_weather_data BOOLEAN DEFAULT FALSE,
    has_mood_data BOOLEAN DEFAULT FALSE,
    limitless_entry_count INTEGER DEFAULT 0,
    bee_conversation_count INTEGER DEFAULT 0,
    ai_summary TEXT, -- AI-generated summary for the day
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- UNIQUE (date, user_id) -- If user_id is added
);
CREATE TRIGGER set_daily_aggregations_timestamp
BEFORE UPDATE ON daily_aggregations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


-- === Indexes for Performance ===

-- Date-based indexes for calendar performance and range queries
CREATE INDEX idx_limitless_entries_start_time ON limitless_entries(start_time DESC);
CREATE INDEX idx_limitless_entries_date ON limitless_entries(DATE(start_time) DESC);

CREATE INDEX idx_bee_conversations_start_time ON bee_conversations(start_time DESC);
CREATE INDEX idx_bee_conversations_date ON bee_conversations(DATE(start_time) DESC);
CREATE INDEX idx_bee_utterances_spoken_at ON bee_utterances(spoken_at DESC);

CREATE INDEX idx_weather_entries_date ON weather_entries(date DESC);
CREATE INDEX idx_mood_entries_date ON mood_entries(date DESC);
-- CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, date DESC); -- If user_id is used

CREATE INDEX idx_daily_aggregations_date ON daily_aggregations(date DESC);
-- CREATE INDEX idx_daily_aggregations_user_date ON daily_aggregations(user_id, date DESC); -- If user_id is used

-- Foreign key indexes (PostgreSQL creates them for PRIMARY KEY and UNIQUE constraints, but good to be aware)
CREATE INDEX idx_limitless_content_nodes_entry_id ON limitless_content_nodes(entry_id);
CREATE INDEX idx_limitless_content_nodes_parent_id ON limitless_content_nodes(parent_id);
CREATE INDEX idx_bee_utterances_conversation_id ON bee_utterances(conversation_id);

-- Indexes for text searching (GIN or GIST depending on needs, tsvector for full-text search)
-- Example for Limitless entries (can be expanded)
-- ALTER TABLE limitless_entries ADD COLUMN tsv tsvector;
-- CREATE INDEX limitless_entries_tsv ON limitless_entries USING gin(tsv);
-- CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE ON limitless_entries FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(tsv, 'pg_catalog.english', title, markdown_content);

-- Example for Bee conversations
-- ALTER TABLE bee_conversations ADD COLUMN tsv tsvector;
-- CREATE INDEX bee_conversations_tsv ON bee_conversations USING gin(tsv);
-- CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE ON bee_conversations FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(tsv, 'pg_catalog.english', summary, short_summary);


-- Initial Data (Optional Seed Data)
-- INSERT INTO mood_entries (date, mood_score, mood_text, notes) VALUES (CURRENT_DATE - INTERVAL '1 day', 7, 'Productive', 'Had a good day working on Lifeboard.');
-- INSERT INTO weather_entries (date, location, temperature_high, temperature_low, condition, description) VALUES (CURRENT_DATE - INTERVAL '1 day', 'Test City, TC', 25, 15, 'Sunny', 'Clear skies all day.');

-- Log completion
-- (Cannot directly log from SQL script in a way that shows up in app logs, but this indicates the script's end)
-- SELECT 'Database initialization script completed.' AS status;

-- Note: For multi-user systems, most tables would also need a 'user_id' column and appropriate indexing.
-- For MVP, assuming single user or user_id is handled at application layer / implicitly.
-- The 'user_id' columns are added but commented out or nullable for now.
-- If user_id becomes mandatory, constraints and indexes should be updated.
-- For example, mood_entries UNIQUE constraint would be (user_id, date).

-- Default user_id for single-user MVP (if needed for FKs or logic)
-- CREATE TABLE users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     username VARCHAR(255) UNIQUE NOT NULL,
--     email VARCHAR(255) UNIQUE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- INSERT INTO users (id, username) VALUES ('00000000-0000-0000-0000-000000000000', 'default_user') ON CONFLICT DO NOTHING;
-- Then, user_id columns could default to this UUID.
-- For MVP, we are keeping it simpler and user_id is mostly for future planning.
-- The current mood_entries unique constraint is (user_id, date), which means user_id should be populated.
-- Let's make user_id nullable for now or remove it for pure single-user MVP.
-- For MVP, let's simplify and remove user_id from mood_entries and daily_aggregations unique constraints
-- and make the columns nullable.

ALTER TABLE mood_entries DROP CONSTRAINT IF EXISTS mood_entries_user_id_date_key;
ALTER TABLE mood_entries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE mood_entries ADD CONSTRAINT mood_entries_date_key UNIQUE (date); -- Assuming single user for MVP

ALTER TABLE daily_aggregations DROP CONSTRAINT IF EXISTS daily_aggregations_date_user_id_key;
ALTER TABLE daily_aggregations ALTER COLUMN user_id DROP NOT NULL;
-- The daily_aggregations already has UNIQUE (date)

-- System Metadata Table (for BaseConnector and general app settings)
CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_system_metadata_timestamp
BEFORE UPDATE ON system_metadata
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- End of script
