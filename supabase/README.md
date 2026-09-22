# Base de datos — Bitácora SPARTANS 8327

Este proyecto usa Supabase (Postgres + Auth + Storage). El esquema vive
versionado aquí, en `migrations/`, en vez de aplicarse a mano desde el
dashboard sin registro.

## Cómo aplicar el esquema (Fase 1)

Como todavía no usamos la Supabase CLI vinculada a tu proyecto (no
compartimos contraseñas de base de datos ni tokens de servicio por chat), la
forma más simple de aplicar esto es:

1. Entra al dashboard de tu proyecto en https://supabase.com/dashboard
2. Ve a **SQL Editor** → **New query**
3. Copia y pega el contenido completo de `migrations/0001_core_schema.sql`,
   ejecútalo.
4. Copia y pega el contenido completo de `seed.sql`, ejecútalo.
   (Esto inserta la temporada 2026-2027, el roster real de 15 miembros —
   todos con rol `member`, sin admin asignado — y las categorías iniciales
   de área/tipo de actividad.)
5. Confirma en **Table Editor** que aparecen las tablas `seasons`,
   `team_members`, `categories` con los datos esperados.

## Fase 2: sesiones y evidencia

Cuando quieras habilitar el registro rápido de sesiones:

1. En el mismo **SQL Editor**, pega y ejecuta el contenido completo de
   `migrations/0002_sessions_and_evidence.sql`.
2. Esto crea `sessions`, `session_participants`, `session_categories`,
   `evidence`, sus políticas de RLS, y el bucket privado de Storage
   `evidence` (con sus propias políticas). No requiere nada adicional desde
   el dashboard: el bucket se crea por SQL.
3. Confirma en **Storage** que aparece el bucket `evidence` (privado).

## Definir el primer administrador

Ningún miembro tiene rol `admin` por defecto (decisión explícita del
equipo). Cuando decidas quién será admin:

```sql
update public.team_members
set role = 'admin'
where full_name = 'NOMBRE_DEL_MIEMBRO';
```

Ejecútalo tú mismo desde el SQL Editor (bypassa RLS al correr como rol
`postgres`) — la app nunca permite que un miembro se auto-asigne admin (hay
un trigger, `prevent_self_privilege_escalation`, que lo bloquea a nivel de
base de datos).

## Vincular una cuenta de Auth a un miembro del roster

Cuando un miembro crea su cuenta (Supabase Auth), su fila en `team_members`
sigue sin `auth_user_id` hasta que un admin la vincule manualmente (esto se
construirá como parte del panel `/admin` en una fase posterior). Por ahora,
puede hacerse a mano:

```sql
update public.team_members
set auth_user_id = 'uuid-del-usuario-de-auth'
where full_name = 'NOMBRE_DEL_MIEMBRO';
```

## Regenerar tipos de TypeScript

Una vez aplicado el esquema, desde tu máquina (con la Supabase CLI
instalada y con tu propia sesión/credenciales, no las mías):

```bash
npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.ts
```

Esto reemplaza el placeholder (`export type Database = any`) por tipos
reales generados desde el esquema.
