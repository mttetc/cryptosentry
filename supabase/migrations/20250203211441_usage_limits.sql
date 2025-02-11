-- Create usage_limits table
CREATE TABLE IF NOT EXISTS usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  call_count integer DEFAULT 0,
  sms_count integer DEFAULT 0,
  last_call_at timestamptz,
  last_sms_at timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, phone_number, date)
);

-- Create indexes for efficient querying
CREATE INDEX idx_usage_limits_user_phone ON usage_limits(user_id, phone_number);
CREATE INDEX idx_usage_limits_date ON usage_limits(date);

-- Add RLS policies
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage limits
CREATE POLICY "Users can view their own usage limits"
  ON usage_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only the application can insert/update usage limits
CREATE POLICY "Service role can manage usage limits"
  ON usage_limits
  USING (true)
  WITH CHECK (true);

-- Function to clean up old usage limits (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_usage_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM usage_limits
  WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$;

-- Create a daily cleanup job
SELECT cron.schedule(
  'cleanup-usage-limits',
  '0 0 * * *', -- Run at midnight every day
  $$
    SELECT cleanup_old_usage_limits();
  $$
); 