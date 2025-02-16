-- Create processed_posts table
CREATE TABLE IF NOT EXISTS processed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  post_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Create unique constraint to prevent duplicates
  CONSTRAINT unique_post UNIQUE (account, post_id)
);

-- Create index for faster lookups
CREATE INDEX idx_processed_posts_account ON processed_posts(account);
CREATE INDEX idx_processed_posts_processed_at ON processed_posts(processed_at);

-- Add RLS policies
ALTER TABLE processed_posts ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Anyone can read processed posts"
  ON processed_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow system to insert/update/delete
CREATE POLICY "Only system can modify processed posts"
  ON processed_posts
  USING (auth.uid() IN (
    SELECT user_id FROM users WHERE role = 'system'
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM users WHERE role = 'system'
  )); 