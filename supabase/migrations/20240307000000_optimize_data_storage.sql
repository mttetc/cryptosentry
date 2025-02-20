-- Create user_notification_settings table
CREATE TABLE user_notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    prefer_sms BOOLEAN NOT NULL DEFAULT false,
    active_24h BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    weekends_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[1-9]\d{1,14}$')
);

-- Add RLS policies for user_notification_settings
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification settings"
    ON user_notification_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
    ON user_notification_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
    ON user_notification_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger for user_notification_settings
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_settings_timestamp
    BEFORE UPDATE ON user_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_settings_updated_at();

-- Create latest_prices table
CREATE TABLE latest_prices (
    symbol TEXT PRIMARY KEY,
    price DECIMAL NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT positive_price CHECK (price > 0)
);

-- Add RLS policies for latest_prices
ALTER TABLE latest_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view latest prices"
    ON latest_prices FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage latest prices"
    ON latest_prices FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Modify alert_history table
ALTER TABLE alert_history
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS target_price,
    DROP COLUMN IF EXISTS combined_condition,
    DROP COLUMN IF EXISTS combined_prices,
    ADD COLUMN IF NOT EXISTS condition_type TEXT,
    ADD COLUMN IF NOT EXISTS assets_involved TEXT[],
    ADD CONSTRAINT valid_condition_type CHECK (
        condition_type IN ('single', 'AND', 'OR')
    );

-- Add trigger information to price_alerts
ALTER TABLE price_alerts
    ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS triggered_price DECIMAL,
    ADD CONSTRAINT valid_triggered_price CHECK (
        triggered_price IS NULL OR triggered_price > 0
    );

-- Migrate existing user preferences to new table
INSERT INTO user_notification_settings (
    user_id,
    phone,
    prefer_sms,
    active_24h,
    quiet_hours_start,
    quiet_hours_end,
    weekends_enabled
)
SELECT 
    id as user_id,
    phone,
    prefer_sms,
    active_24h,
    quiet_hours_start::TIME,
    quiet_hours_end::TIME,
    weekends_enabled
FROM users
ON CONFLICT (user_id) DO UPDATE
SET
    phone = EXCLUDED.phone,
    prefer_sms = EXCLUDED.prefer_sms,
    active_24h = EXCLUDED.active_24h,
    quiet_hours_start = EXCLUDED.quiet_hours_start,
    quiet_hours_end = EXCLUDED.quiet_hours_end,
    weekends_enabled = EXCLUDED.weekends_enabled;

-- Remove redundant columns from users table
ALTER TABLE users
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS prefer_sms,
    DROP COLUMN IF EXISTS active_24h,
    DROP COLUMN IF EXISTS quiet_hours_start,
    DROP COLUMN IF EXISTS quiet_hours_end,
    DROP COLUMN IF EXISTS weekends_enabled; 