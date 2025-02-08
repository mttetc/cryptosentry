/*
  # Trading Alert System Schema

  1. Enhanced Tables
    - `users`
      - Added quiet hours and weekend settings
      - Added rate limiting fields
    
    - `price_alerts`
      - Added support for percentage-based alerts
      - Added support for between conditions
      - Added one-time alert flag
    
    - `alert_history`
      - Track all alert triggers
      - Store notification success/failure
*/

-- Users table with enhanced settings
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  phone text NOT NULL,
  active_24h boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  weekends_enabled boolean DEFAULT true,
  last_notification_at timestamptz,
  notification_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own data"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Price alerts table with enhanced conditions
CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  target_price decimal NOT NULL,
  target_price_2 decimal, -- For 'between' condition
  percentage_change decimal,
  alert_above boolean DEFAULT false,
  alert_below boolean DEFAULT false,
  condition_type text CHECK (condition_type IN ('above', 'below', 'between')),
  time_window integer, -- In minutes, for time-based conditions
  deactivate_after_trigger boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sound_id uuid REFERENCES custom_sounds(id),
  team_id uuid REFERENCES teams(id)
);

CREATE INDEX idx_price_alerts_symbol ON price_alerts(symbol) WHERE active = true;
CREATE INDEX idx_price_alerts_user ON price_alerts(user_id) WHERE active = true;

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own price alerts"
  ON price_alerts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Social alerts table with enhanced keyword matching
CREATE TABLE IF NOT EXISTS social_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  account text,
  keywords text[],
  keyword_logic text DEFAULT 'AND' CHECK (keyword_logic IN ('AND', 'OR')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sound_id uuid REFERENCES custom_sounds(id),
  team_id uuid REFERENCES teams(id)
);

CREATE INDEX idx_social_alerts_user ON social_alerts(user_id) WHERE active = true;

ALTER TABLE social_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own social alerts"
  ON social_alerts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alert history table
CREATE TABLE IF NOT EXISTS alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  alert_id uuid,
  alert_type text CHECK (alert_type IN ('price', 'social')),
  symbol text,
  target_price decimal,
  triggered_price decimal,
  percentage_change decimal,
  account text,
  content text,
  matched_keywords text[],
  notification_success boolean,
  notification_type text CHECK (notification_type IN ('call', 'sms')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alert_history_user ON alert_history(user_id);
CREATE INDEX idx_alert_history_created ON alert_history(created_at DESC);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert history"
  ON alert_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_price_alerts_updated_at
    BEFORE UPDATE ON price_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_alerts_updated_at
    BEFORE UPDATE ON social_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Custom sounds table
CREATE TABLE IF NOT EXISTS custom_sounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  public_url text NOT NULL,
  duration integer NOT NULL, -- in seconds
  is_loopable boolean DEFAULT false,
  is_emergency boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  team_id uuid REFERENCES teams(id)
);

CREATE INDEX idx_custom_sounds_user ON custom_sounds(user_id);

ALTER TABLE custom_sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sounds"
  ON custom_sounds
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add sound_id to price_alerts and social_alerts
ALTER TABLE price_alerts ADD COLUMN sound_id uuid REFERENCES custom_sounds(id);
ALTER TABLE social_alerts ADD COLUMN sound_id uuid REFERENCES custom_sounds(id);

-- Add trigger for custom_sounds updated_at
CREATE TRIGGER update_custom_sounds_updated_at
    BEFORE UPDATE ON custom_sounds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners can manage their teams"
  ON teams
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('admin', 'member', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners and admins can manage members"
  ON team_members
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id FROM teams WHERE id = team_id
      UNION
      SELECT user_id FROM team_members WHERE team_id = team_members.team_id AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT owner_id FROM teams WHERE id = team_id
      UNION
      SELECT user_id FROM team_members WHERE team_id = team_members.team_id AND role = 'admin'
    )
  );

-- Add team_id to existing tables
ALTER TABLE price_alerts ADD COLUMN team_id uuid REFERENCES teams(id);
ALTER TABLE social_alerts ADD COLUMN team_id uuid REFERENCES social_alerts(id);
ALTER TABLE custom_sounds ADD COLUMN team_id uuid REFERENCES teams(id);

-- Update RLS policies for team access
CREATE POLICY "Team members can view team alerts"
  ON price_alerts
  FOR SELECT
  TO authenticated
  USING (
    team_id IS NULL AND auth.uid() = user_id
    OR
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Team members can view team alerts"
  ON social_alerts
  FOR SELECT
  TO authenticated
  USING (
    team_id IS NULL AND auth.uid() = user_id
    OR
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Team members can view team sounds"
  ON custom_sounds
  FOR SELECT
  TO authenticated
  USING (
    team_id IS NULL AND auth.uid() = user_id
    OR
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- Function to check team member role
CREATE OR REPLACE FUNCTION check_team_role(
  _team_id uuid,
  _user_id uuid,
  _required_role text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    WHERE (t.id = _team_id AND t.owner_id = _user_id)
    OR (tm.team_id = _team_id AND tm.user_id = _user_id AND
        CASE _required_role
          WHEN 'admin' THEN tm.role = 'admin'
          WHEN 'member' THEN tm.role IN ('admin', 'member')
          WHEN 'viewer' THEN tm.role IN ('admin', 'member', 'viewer')
        END
    )
  );
END;
$$;