-- Migration v017: persist the odontogram image used in a treatment plan so the
-- PDF can be regenerated later (e.g. from the "Descargar PDF" button) with the
-- same odontogram embedded.

ALTER TABLE quotes ADD COLUMN odontogram_image_path TEXT;
