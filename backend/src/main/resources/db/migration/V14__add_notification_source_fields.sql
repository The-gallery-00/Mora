ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS target_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_source_target
    ON notifications(user_id, type, source_type, source_id, target_date)
    WHERE source_type IS NOT NULL
      AND source_id IS NOT NULL
      AND target_date IS NOT NULL;
