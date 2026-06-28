# Iluxol - Gestión de clientes y notas

Aplicación web interna para gestionar clientes, domicilios y notas de aviso,
sustituyendo el archivo de Access. Módulos incluidos: Notas, Clientes,
Ajustes (listas configurables). Login por empleado.

## Qué necesitas antes de empezar

- Una cuenta gratuita en https://supabase.com
- Una cuenta gratuita en https://vercel.com
- Una cuenta en GitHub (gratuita) para subir el código

No necesitas saber programar para los pasos siguientes: son todos
formularios y botones en páginas web.

---

## Paso 1 — Crear el proyecto en Supabase

1. Entra en https://supabase.com y crea un proyecto nuevo (elige una
   contraseña fuerte para la base de datos y guárdala en un lugar seguro).
2. Cuando el proyecto esté listo, ve al menú lateral **SQL Editor**.
3. Abre el archivo `schema.sql` de este proyecto, copia todo su contenido,
   pégalo en el editor SQL de Supabase y pulsa **Run**. Esto crea todas las
   tablas, listas y reglas de seguridad de golpe.
4. Ve a **Project Settings → API**. Ahí verás:
   - **Project URL** → la necesitarás en el paso 3.
   - **anon public key** → también la necesitarás en el paso 3.

## Paso 2 — Crear el primer empleado (tú)

1. En Supabase, ve a **Authentication → Users → Add user**.
2. Pon tu email y una contraseña. Pulsa crear.
3. Ve a **SQL Editor** y ejecuta esto (cambia el email por el tuyo y pon tu
   nombre):

   ```sql
   insert into perfiles (id, nombre_completo, rol)
   select id, 'Tu Nombre', 'admin'
   from auth.users
   where email = 'tu-email@iluxol.es';
   ```

   Esto te da acceso a la aplicación. Repite este mismo proceso (crear
   usuario + este SQL con rol 'empleado') por cada persona que vaya a
   usar la app.

## Paso 3 — Subir el código a GitHub

1. Crea un repositorio nuevo (puede ser privado) en GitHub.
2. Sube todos los archivos de esta carpeta a ese repositorio. Si nunca lo
   has hecho, GitHub Desktop (https://desktop.github.com) tiene un asistente
   visual sin usar la línea de comandos.

## Paso 4 — Desplegar en Vercel

1. Entra en https://vercel.com y conecta tu cuenta de GitHub.
2. Pulsa **Add New → Project** y elige el repositorio que acabas de subir.
3. En la pantalla de configuración, antes de pulsar Deploy, añade dos
   variables de entorno (sección **Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL` → el Project URL del paso 1.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → el anon public key del paso 1.
4. Pulsa **Deploy**. En 1-2 minutos tendrás una URL pública
   (algo como `iluxol-app.vercel.app`) funcionando de verdad.

## Paso 5 — Entrar y probar

Abre la URL que te dio Vercel, entra con tu email y contraseña del paso 2,
y deberías ver el menú con Notas, Clientes y Ajustes.

---

## Notas importantes

- **Fotos de domicilio y documentos**: el esquema crea automáticamente los buckets de Storage
  necesarios (`domicilios-fotos`, `clientes-documentos`) la primera vez que ejecutas `schema.sql`.
  No necesitas crearlos a mano en el panel de Supabase.
- **Dominio propio**: si más adelante quieres usar algo como
  `gestion.iluxol.es` en vez de la URL de Vercel, eso se configura en
  Vercel → Settings → Domains, gratis, solo necesitas acceso a la gestión
  de tu dominio.
- **Las claves "anon" se renombrarán en el futuro**: Supabase está
  migrando hacia claves llamadas "publishable" y "secret". Durante la
  transición ambos nombres funcionan igual; si en el futuro no encuentras
  "anon public key" en el panel, busca "publishable key" en su lugar.
- **Variables de entorno en Vercel**: no las marques como "Sensitive" — esa opción
  oculta su valor incluso durante la construcción de la app y puede provocar errores
  de despliegue con las variables `NEXT_PUBLIC_*`.
- **Pendiente**: la migración de tus datos reales de Access (clientes, domicilios, notas).
