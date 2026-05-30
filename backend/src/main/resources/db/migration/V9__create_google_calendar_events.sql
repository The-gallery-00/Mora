CREATE TABLE IF NOT EXISTS google_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL,
    document_id VARCHAR(64) NOT NULL,
    google_event_id VARCHAR(255) NOT NULL,
    calendar_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_events_document
    ON google_calendar_events(user_id, document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_id
    ON google_calendar_events(user_id);
