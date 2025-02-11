-- Add security-related columns to usage_limits
ALTER TABLE usage_limits
ADD COLUMN failure_patterns jsonb DEFAULT '{"consecutive_failures": 0, "machine_detections": 0, "short_calls": 0}'::jsonb,
ADD COLUMN blocked_until timestamptz,
ADD COLUMN block_reason text,
ADD COLUMN risk_score float DEFAULT 0.0;

-- Create table for DID performance tracking
CREATE TABLE IF NOT EXISTS did_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_number text NOT NULL UNIQUE,
  total_calls integer DEFAULT 0,
  successful_calls integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  machine_detections integer DEFAULT 0,
  short_calls integer DEFAULT 0,
  avg_call_duration float DEFAULT 0.0,
  last_used_at timestamptz,
  cool_off_until timestamptz,
  performance_score float DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_did_performance_score ON did_performance(performance_score DESC);
CREATE INDEX idx_did_last_used ON did_performance(last_used_at);

-- Function to calculate risk score
CREATE OR REPLACE FUNCTION calculate_risk_score(
  failure_patterns jsonb,
  call_history jsonb DEFAULT NULL
) RETURNS float
LANGUAGE plpgsql
AS $$
DECLARE
  base_score float := 0.0;
  pattern_weight float := 0.3;
  history_weight float := 0.7;
BEGIN
  -- Calculate score from failure patterns
  base_score := base_score + (
    (failure_patterns->>'consecutive_failures')::float * 0.4 +
    (failure_patterns->>'machine_detections')::float * 0.3 +
    (failure_patterns->>'short_calls')::float * 0.3
  ) * pattern_weight;

  -- If call history is provided, factor it in
  IF call_history IS NOT NULL THEN
    base_score := base_score + (
      (call_history->>'failed_ratio')::float * 0.5 +
      (call_history->>'spam_score')::float * 0.5
    ) * history_weight;
  END IF;

  RETURN LEAST(1.0, GREATEST(0.0, base_score));
END;
$$;

-- Function to update DID performance
CREATE OR REPLACE FUNCTION update_did_performance(
  p_did_number text,
  p_call_status text,
  p_duration integer,
  p_machine_detected boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_performance did_performance;
  v_score float;
BEGIN
  -- Get or create DID record
  INSERT INTO did_performance (did_number)
  VALUES (p_did_number)
  ON CONFLICT (did_number) DO NOTHING;

  SELECT * INTO v_performance
  FROM did_performance
  WHERE did_number = p_did_number
  FOR UPDATE;

  -- Update call counts
  UPDATE did_performance
  SET
    total_calls = total_calls + 1,
    successful_calls = successful_calls + CASE WHEN p_call_status = 'completed' THEN 1 ELSE 0 END,
    failed_calls = failed_calls + CASE WHEN p_call_status IN ('failed', 'busy', 'no-answer') THEN 1 ELSE 0 END,
    machine_detections = machine_detections + CASE WHEN p_machine_detected THEN 1 ELSE 0 END,
    short_calls = short_calls + CASE WHEN p_duration < 3 AND p_call_status = 'completed' THEN 1 ELSE 0 END,
    avg_call_duration = (avg_call_duration * total_calls + p_duration) / (total_calls + 1),
    last_used_at = now(),
    updated_at = now()
  WHERE did_number = p_did_number;

  -- Calculate new performance score
  v_score := (
    (v_performance.successful_calls::float / GREATEST(v_performance.total_calls, 1)) * 0.4 +
    (1.0 - (v_performance.machine_detections::float / GREATEST(v_performance.total_calls, 1))) * 0.3 +
    (1.0 - (v_performance.short_calls::float / GREATEST(v_performance.total_calls, 1))) * 0.3
  );

  -- Update performance score and set cool-off if needed
  UPDATE did_performance
  SET
    performance_score = v_score,
    cool_off_until = CASE
      WHEN v_score < 0.3 THEN now() + INTERVAL '1 day'
      WHEN v_score < 0.5 THEN now() + INTERVAL '4 hours'
      WHEN v_score < 0.7 THEN now() + INTERVAL '1 hour'
      ELSE NULL
    END
  WHERE did_number = p_did_number;
END;
$$;

-- Function to get next best DID
CREATE OR REPLACE FUNCTION get_next_did(
  p_exclude_numbers text[] DEFAULT ARRAY[]::text[]
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_did text;
BEGIN
  -- Get the best performing available DID
  SELECT did_number INTO v_did
  FROM did_performance
  WHERE 
    did_number != ALL(p_exclude_numbers)
    AND (cool_off_until IS NULL OR cool_off_until < now())
    AND performance_score >= 0.3
  ORDER BY 
    performance_score DESC,
    last_used_at ASC NULLS FIRST
  LIMIT 1;

  -- If no good DID found, get any available one
  IF v_did IS NULL THEN
    SELECT did_number INTO v_did
    FROM did_performance
    WHERE 
      did_number != ALL(p_exclude_numbers)
      AND (cool_off_until IS NULL OR cool_off_until < now())
    ORDER BY 
      last_used_at ASC NULLS FIRST
    LIMIT 1;
  END IF;

  RETURN v_did;
END;
$$;

-- Function to handle suspicious activity
CREATE OR REPLACE FUNCTION handle_suspicious_activity(
  p_user_id uuid,
  p_phone text,
  p_failure_type text,
  p_severity float DEFAULT 0.2
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_patterns jsonb;
  v_risk_score float;
BEGIN
  -- Get current patterns
  SELECT failure_patterns, risk_score INTO v_current_patterns, v_risk_score
  FROM usage_limits
  WHERE user_id = p_user_id AND phone_number = p_phone
  AND date = CURRENT_DATE
  FOR UPDATE;

  -- Update failure patterns
  v_current_patterns := jsonb_set(
    v_current_patterns,
    ARRAY[p_failure_type],
    to_jsonb((v_current_patterns->>p_failure_type)::int + 1)
  );

  -- Calculate new risk score
  v_risk_score := v_risk_score + p_severity;

  -- Update usage limits with new patterns and potential block
  UPDATE usage_limits
  SET
    failure_patterns = v_current_patterns,
    risk_score = LEAST(1.0, v_risk_score),
    blocked_until = CASE
      WHEN v_risk_score >= 0.8 THEN now() + INTERVAL '24 hours'
      WHEN v_risk_score >= 0.6 THEN now() + INTERVAL '6 hours'
      WHEN v_risk_score >= 0.4 THEN now() + INTERVAL '1 hour'
      ELSE blocked_until
    END,
    block_reason = CASE
      WHEN v_risk_score >= 0.4 THEN 'Suspicious activity detected'
      ELSE block_reason
    END
  WHERE user_id = p_user_id AND phone_number = p_phone
  AND date = CURRENT_DATE;
END;
$$; 