-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  data jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);

-- Add RLS policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Only allow admins to read error logs
CREATE POLICY "Only admins can read error logs"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM users WHERE role = 'admin'
    )
  );

-- Only allow system to insert error logs
CREATE POLICY "Only system can insert error logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM users WHERE role = 'system'
    )
  );

-- Automatically delete logs older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS trigger AS $$
BEGIN
  DELETE FROM error_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_old_error_logs_trigger
  AFTER INSERT ON error_logs
  EXECUTE FUNCTION cleanup_old_error_logs(); 