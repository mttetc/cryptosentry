-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  type text NOT NULL CHECK (type IN ('received', 'processed', 'error')),
  payload jsonb,
  error text,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_webhook_logs_service ON webhook_logs(service);
CREATE INDEX idx_webhook_logs_type ON webhook_logs(type);
CREATE INDEX idx_webhook_logs_timestamp ON webhook_logs(timestamp DESC);

-- Enable RLS
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only allow admins to view webhook logs
CREATE POLICY "Only admins can view webhook logs"
  ON webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM team_members 
      WHERE role = 'admin'
      UNION
      SELECT owner_id 
      FROM teams
    )
  ); 