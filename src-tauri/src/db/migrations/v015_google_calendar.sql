-- Migration v015: Google Calendar integration
-- Stores the Google Calendar event id linked to each appointment (one-way sync app -> Google).
-- OAuth tokens and configuration are stored in the existing `settings` key-value table
-- under keys: google_calendar_enabled, google_client_id, google_client_secret,
-- google_refresh_token, google_access_token, google_token_expiry, google_calendar_id,
-- google_account_email.

ALTER TABLE appointments ADD COLUMN google_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON appointments(google_event_id);
