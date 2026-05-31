CREATE TABLE IF NOT EXISTS business_card_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_business_card_groups_user_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_business_card_groups_user_id
    ON business_card_groups(user_id);

ALTER TABLE business_cards
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES business_card_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_cards_group_id
    ON business_cards(group_id);
