-- Create AMD results table
CREATE TABLE IF NOT EXISTS amd_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  detection_type TEXT NOT NULL,
  beep_detected BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  message_delivered BOOLEAN DEFAULT false,
  duration INTEGER NOT NULL,
  cost DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_amd_results_user_id ON amd_results(user_id);
CREATE INDEX idx_amd_results_timestamp ON amd_results(timestamp);
CREATE INDEX idx_amd_results_detection_type ON amd_results(detection_type);

-- Add RLS policies
ALTER TABLE amd_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AMD results"
  ON amd_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AMD results"
  ON amd_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_amd_results_updated_at
    BEFORE UPDATE ON amd_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 