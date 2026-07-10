-- Migration v002: Seed admin user
-- The password_hash will be set programmatically after migration runs.
-- This migration only creates the row if it doesn't exist.
-- Default password: 'admin123' (must be changed on first login)

INSERT OR IGNORE INTO users (username, password_hash, role, display_name, must_change_password)
VALUES ('admin', '__PENDING_HASH__', 'master', 'Administrador', 1);
