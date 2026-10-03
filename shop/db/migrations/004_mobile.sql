ALTER TABLE oauth_states ADD COLUMN mobile_challenge text;
ALTER TABLE sessions ADD COLUMN parent_token_hash text REFERENCES sessions(token_hash) ON DELETE CASCADE;
CREATE TABLE mobile_login_codes(code_hash text PRIMARY KEY, challenge text NOT NULL, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL);
CREATE TABLE mobile_checkout_tickets(token_hash text PRIMARY KEY, session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
