CREATE TABLE welcome_email_outbox (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent')),
 attempts integer NOT NULL DEFAULT 0,
 lease_until timestamptz,
 message_id text,
 sent_at timestamptz
);
