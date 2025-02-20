-- Create did_numbers table
CREATE TABLE did_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'telnyx',
    active BOOLEAN NOT NULL DEFAULT true,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    machine_detection_rate FLOAT NOT NULL DEFAULT 0,
    average_duration FLOAT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_number CHECK (number ~ '^\+?[1-9]\d{1,14}$')
);

-- Add RLS policies
ALTER TABLE did_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage all DID numbers"
    ON did_numbers FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Authenticated users can view active DID numbers"
    ON did_numbers FOR SELECT
    USING (active = true AND auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_did_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_did_numbers_updated_at
    BEFORE UPDATE ON did_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_did_numbers_updated_at();

-- Create index for performance
CREATE INDEX idx_did_numbers_active_last_used ON did_numbers (active, last_used_at)
    WHERE active = true;

-- Insert default backup number
INSERT INTO did_numbers (number, provider, active)
VALUES (current_setting('app.settings.backup_did_number'), 'telnyx', true)
ON CONFLICT (number) DO NOTHING; 