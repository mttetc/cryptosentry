-- Add rate limiting columns to usage_limits
ALTER TABLE usage_limits
ADD COLUMN calls_last_minute integer[] DEFAULT ARRAY[]::integer[],
ADD COLUMN sms_last_minute integer[] DEFAULT ARRAY[]::integer[],
ADD COLUMN last_cleanup_at timestamptz,
ADD COLUMN consecutive_failures integer DEFAULT 0;

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  timestamps integer[],
  window_seconds integer,
  max_requests integer
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_time integer;
  filtered_timestamps integer[];
BEGIN
  current_time := EXTRACT(EPOCH FROM now())::integer;
  
  -- Filter timestamps within the window
  filtered_timestamps := ARRAY(
    SELECT ts 
    FROM unnest(timestamps) ts 
    WHERE ts > (current_time - window_seconds)
  );
  
  RETURN array_length(filtered_timestamps, 1) < max_requests;
END;
$$;

-- Create function to update rate limit arrays
CREATE OR REPLACE FUNCTION update_rate_limit_array(
  timestamps integer[],
  window_seconds integer
) RETURNS integer[]
LANGUAGE plpgsql
AS $$
DECLARE
  current_time integer;
BEGIN
  current_time := EXTRACT(EPOCH FROM now())::integer;
  
  -- Remove old timestamps and add new one
  RETURN ARRAY(
    SELECT ts 
    FROM unnest(timestamps) ts 
    WHERE ts > (current_time - window_seconds)
  ) || current_time;
END;
$$;

-- Enhanced cleanup function with better strategies
CREATE OR REPLACE FUNCTION cleanup_usage_limits(
  max_age_days integer DEFAULT 30,
  batch_size integer DEFAULT 1000
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_before date;
  affected_rows integer;
BEGIN
  cleanup_before := CURRENT_DATE - max_age_days * INTERVAL '1 day';
  
  -- Archive data before deletion (optional)
  INSERT INTO usage_limits_archive (
    user_id, phone_number, call_count, sms_count,
    last_call_at, last_sms_at, date, created_at, updated_at
  )
  SELECT 
    user_id, phone_number, call_count, sms_count,
    last_call_at, last_sms_at, date, created_at, updated_at
  FROM usage_limits
  WHERE date < cleanup_before
  AND NOT EXISTS (
    SELECT 1 FROM usage_limits_archive a 
    WHERE a.user_id = usage_limits.user_id 
    AND a.date = usage_limits.date
  );

  -- Cleanup in batches
  LOOP
    -- Delete old records
    WITH deleted AS (
      DELETE FROM usage_limits
      WHERE date < cleanup_before
      AND id IN (
        SELECT id FROM usage_limits
        WHERE date < cleanup_before
        LIMIT batch_size
      )
      RETURNING id
    )
    SELECT count(*) INTO affected_rows FROM deleted;

    EXIT WHEN affected_rows = 0;
    COMMIT;
    
    -- Sleep briefly between batches to reduce load
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Reset rate limit arrays for old entries
  UPDATE usage_limits
  SET 
    calls_last_minute = ARRAY[]::integer[],
    sms_last_minute = ARRAY[]::integer[],
    last_cleanup_at = now()
  WHERE 
    (
      array_length(calls_last_minute, 1) > 0 OR 
      array_length(sms_last_minute, 1) > 0
    )
    AND last_cleanup_at < now() - INTERVAL '1 hour';
END;
$$;

-- Create archive table for historical data
CREATE TABLE IF NOT EXISTS usage_limits_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  call_count integer,
  sms_count integer,
  last_call_at timestamptz,
  last_sms_at timestamptz,
  date date NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

-- Create indexes for archive table
CREATE INDEX idx_usage_limits_archive_user_date 
ON usage_limits_archive(user_id, date);

-- Update the cleanup schedule to run more frequently
SELECT cron.schedule(
  'cleanup-usage-limits',
  '0 */4 * * *', -- Run every 4 hours
  $$
    SELECT cleanup_usage_limits(30, 1000);
  $$
); 