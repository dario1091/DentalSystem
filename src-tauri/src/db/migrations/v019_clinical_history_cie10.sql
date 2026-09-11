-- Migration v019: add a structured CIE-10 code to the clinical history.
-- The existing free-text `diagnosis` field remains for the descriptive note;
-- `cie10_code` stores the standardized code (optional) for future RIPS export.

ALTER TABLE clinical_histories ADD COLUMN cie10_code TEXT;
