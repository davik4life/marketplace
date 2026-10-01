export const signupQuery = `WITH registered AS (
 INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)
 ON CONFLICT(google_sub) DO NOTHING RETURNING id
), queued AS (
 INSERT INTO welcome_email_outbox(user_id) SELECT id FROM registered RETURNING user_id
) SELECT user_id AS id FROM queued`;
export const signinQuery = `UPDATE users SET email=$2,name=$3 WHERE google_sub=$1 RETURNING id`;
