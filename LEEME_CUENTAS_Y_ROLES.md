# Alta de cuentas y roles

Cómo se crean las cuentas en la app y qué hace falta para que funcione.

Hay dos caminos de alta, y son distintos a propósito:

| Rol | Quién lo crea | Cómo |
| --- | --- | --- |
| **Ciudadano** | La persona misma | Botón **Crear cuenta** en la pantalla de bienvenida. Entra solo como ciudadano. |
| **Técnico** | El administrador | Pantalla **Personal** del panel municipal. |
| **Administrador** | El administrador | Pantalla **Personal** del panel municipal. |

En la pantalla **Personal** no hay forma de crear ciudadanos, y está
justificado: los ciudadanos se registran solos, así que el municipio no
tiene por qué darlos de alta a mano.

---

## 1. Aplicar los cambios en la base de datos

En **Supabase Dashboard → SQL Editor → New query**, pega y ejecuta el
contenido de `supabase/schema.sql`.

El archivo es idempotente, así que se puede volver a ejecutar las veces que
hagas falta. Es seguro para una base que ya tenga datos.

Esto es lo que añade o arregla:

- El disparador `trg_proteger_perfil`, que impide que alguien se autoasigne
  el rol de administrador.
- El índice único `profiles_codigo_unico`, para que un código de cuenta no
  pueda estar repetido (si lo estuviera, una cuenta quedaría inalcanzable al
  entrar por código).

Si ya tienes la base montada, basta con la parte de abajo del archivo
(empieza en el comentario
`-- Altas de cuentas: ciudadanos (autoregistro) y personal (solo admin)`).

### Comprobar que quedó bien

```sql
-- El disparador de protección está instalado
select tgname from pg_trigger where tgname = 'trg_proteger_perfil';

-- No hay códigos repetidos (no debe devolver filas)
select lower(codigo), count(*)
  from public.profiles
 where codigo is not null
 group by lower(codigo)
having count(*) > 1;

-- Nadie se saltó el control y quedó como administrador sin código ADM
select id, email, codigo
  from public.profiles
 where role = 'Administrador' and (codigo is null or codigo not like 'ADM%');
```

Para probar que la protección funciona de verdad (no con SQL, que corre como
`postgres` y está permitido a propósito): regístrate en la app con un correo
tuyo, y desde la **consola del navegador** con la sesión iniciada intenta:

```js
await supabase.from('profiles').update({ role: 'Administrador' }).eq('id', '<tu-id>')
```

Tiene que fallar con el mensaje *«El rol y el código de cuenta solo los
asigna un administrador»*. Si no falla, el script del paso 1 no llegó a
ejecutarse.

---

## 2. Desplegar la Edge Function

**Este paso es obligatorio para crear técnicos y administradores desde la
app.** El registro de ciudadanos no lo necesita.

### Por qué hace falta

Crear un usuario en Supabase Auth requiere la *clave de servicio*
(`SUPABASE_SERVICE_ROLE_KEY`). Esa clave no puede ir dentro de la app: viaja
en el teléfono de cada usuario y concede acceso total a la base de datos. La
clave de servicio solo puede vivir en un servidor, y el único servidor que
tiene este proyecto es la Edge Function.

Por eso la función es también la que **valida quién puede crear cuentas**:
mira el perfil de quien llama y exige que sea Administrador. No basta con que
la app le pida contraseña.

### Comandos

```bash
npm install -g supabase      # solo la primera vez
supabase login               # abre el navegador para autorizar
supabase link --project-ref btifgxrwmubsbmikchau
supabase functions deploy admin-create-user
```

Si cambiaste `supabase/functions/admin-create-user/index.ts`, vuelve a
ejecutar el último comando.

### Verificar

```bash
supabase functions list
```

Debe aparecer `admin-create-user` con estado `ACTIVE`.

O entra a la app como administrador y crea un técnico de prueba: si la
cuenta aparece en la lista de **Personal**, la función está desplegada.

---

## 3. Ajustes de Authentication

**Supabase Dashboard → Authentication → Sign In / Providers → Email**

- **Enable email signup**: debe estar activado, o el registro de ciudadanos
  no funciona.
- **Confirm email**: da igual si está activado o no, la app se adapts sola:
  - Si está **activado**, tras registrarse aparece «Revisa tu correo» y la
    persona entra recién cuando confirma.
  - Si está **desactivado**, entra directamente.

---

## Problemas frecuentes

**«No se pudo crear la cuenta. … verifica que la función
admin-create-user esté desplegada»**

La Edge Function no está desplegada. Es el paso 2.

**«No se pudo contactar al servidor»**

No hay internet, o la función no está desplegada. En este último caso el
navegador suele dar un error de CORS antes de que la app pueda explicar
nada.

**Un ciudadano no aparece como administrador (correcto)**

Ese es el comportamiento buscado: el rol lo escribe siempre la base de
datos, no la app. Aunque alguien modifique la app para mandar
`role: 'Administrador'` al registrarse, el trigger `handle_new_user` lo
ignora y deja el perfil como `Ciudadano`.

**Alguien ya se había autoasignado el rol de administrador**

Pásale este SQL, que lo revierte al rol que corresponde por su código:

```sql
update public.profiles
   set role = 'Técnico'
 where codigo like 'TEC-%' and role <> 'Técnico';
```

---

## Archivos de este cambio

| Archivo | Para qué |
| --- | --- |
| `supabase/schema.sql` | Disparador de protección del perfil e índice único de códigos. |
| `supabase/functions/admin-create-user/index.ts` | Edge Function que crea técnicos y administradores. |
| `supabase/config.toml` | Configuración del CLI (incluye `verify_jwt = true`). |
| `src/services/auth.js` | `signUp` (ciudadanos), `createAccount` (personal), `fetchAccounts`. |
| `src/context/AuthContext.js` | Expone `register` y `createAccount`. |
| `src/components/RegisterModal.js` | Formulario de registro de ciudadanos. |
| `src/screens/UsersScreen.js` | Pantalla **Personal** del administrador. |
| `src/screens/OnboardingScreen.js` | Botón **Crear cuenta** en bienvenida. |
| `src/screens/MainApp.js` | Entrada **Personal** en el menú del administrador. |
| `src/screens/HomeScreen.js` | Atajo **Personal** en el inicio del administrador. |
