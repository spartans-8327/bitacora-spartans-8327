-- Bitácora SPARTANS 8327 — Fase 2.5 / Bloque C
-- Defensa en profundidad a nivel de Storage para el bucket "evidence".
--
-- El límite de 50 MB por archivo ya se valida en el cliente
-- (src/lib/validation/evidence-file.ts), pero eso solo evita que la app
-- INTENTE subir un archivo más grande — no evita que alguien suba
-- directamente a la API de Storage sin pasar por la app. Este cambio
-- hace que el propio bucket rechace cualquier archivo mayor a 50 MB,
-- sin importar cómo se suba.
--
-- NO se restringe `allowed_mime_types` a nivel de bucket: la evidencia de
-- tipo "file"/"document" debe aceptar formatos variados (PDF, CAD, código,
-- hojas de cálculo, comprimidos, etc.) que no se pueden predecir de
-- antemano para un equipo de robótica. El tipo de archivo ya se restringe
-- correctamente donde sí tiene sentido hacerlo: en el cliente, para
-- "photo" (solo image/*) y "video" (solo video/*).
--
-- Requiere que el bucket "evidence" ya exista (se crea en
-- 0002_sessions_and_evidence.sql). Es seguro volver a ejecutar este
-- archivo más de una vez (solo actualiza un valor existente).

update storage.buckets
set file_size_limit = 52428800 -- 50 MB, en bytes (50 * 1024 * 1024)
where id = 'evidence';

-- Verificación opcional: confirma que el bucket quedó con el límite
-- esperado y sin restricción de tipos MIME.
select id, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'evidence';
