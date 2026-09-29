# Base de datos

Los scripts de esta carpeta se ejecutan en el **SQL Editor de Supabase**
(Dashboard → SQL Editor → *New query* → *Run*). Se pueden volver a
ejecutar las veces que quieras: todos usan `if not exists` / `drop ... if
exists` y están pensados para eso.

## En qué orden

El orden importa. `schema.sql` crea el disparador que llena la tabla
`profiles` al dar de alta a un usuario, y `notificaciones.sql` usa
`is_admin()`, que `schema.sql` define. Si se ejecuta al revés, el segundo
script fallará.

| # | Archivo | Qué hace |
|---|---------|----------|
| 1 | `schema.sql` | Tablas, roles, políticas RLS, disparadores, datos de ejemplo |
| 2 | `tecnicos.sql` | Les asigna rol Técnico, nombre y código a los 7 técnicos |
| 3 | `notificaciones.sql` | Bandeja de avisos, historial de asignaciones, RPC de reasignar |
| 4 | `verificar.sql` | Diagnóstico: lista qué falta, solo lectura |

### Después de ejecutar un script, recarga la caché de la API

Los objetos de la base de datos (tablas, funciones) no los ve la app al
instante. La API guarda su propia lista y hay que avisarla:

```sql
notify pgrst, 'reload schema';
```

Sin esto, la tabla y el RPC existen pero la app sigue respondiendo *«Could not
find the ... in the schema cache»*. Se ejecuta en la misma pestaña del SQL
Editor, en una consulta nueva.

> **Los técnicos hay que crearlos primero a mano.** El SQL no puede
> hacerlo: las contraseñas viven cifradas en Supabase Auth. El paso a paso
> está en la cabecera de `tecnicos.sql`. A partir de ahora también se
> pueden crear desde la propia app: mira
> [`../LEEME_CUENTAS_Y_ROLES.md`](../LEEME_CUENTAS_Y_ROLES.md), que
> explica el paso de desplegar la Edge Function que lo permite.

> **La carpeta `functions/` no se ejecuta desde aquí.** `admin-create-user`
> es código de Deno que corre en el servidor de Supabase, no SQL. Se
> despliega con `supabase functions deploy`, nunca copiando su contenido
> en el SQL Editor.

## Comprobar que quedó bien

`verificar.sql` no modifica nada. Muestra una tabla con un ✓ o un ✗ por
cada punto. Si todo sale con ✓, la base está lista.

```
 ok |                        qué                        |     resultado
----+------------------------------------------------+------------------------
 ✓  | Seguridad por fila activa en incidencias         | correcto
 ✓  | Existe al menos un Administrador (1)            | correcto
 ✓  | Existe al menos un Técnico (7)                  | correcto
 ✗  | Tabla de notificaciones instalada               | FALTA → ejecuta notificaciones.sql
```

## Qué hace cada cosa, y dónde está la garantía

La regla importante de este proyecto: **la app no es la que protege los
datos, es la base**. Que la interfaz no muestre un botón no impide que
alguien llame a la API directamente. Por eso cada regla está escrita dos
veces — en la app para poder explicarla, y en la base para que se cumpla
—, y la de la base es la que manda.

| Regla | En la app | En la base |
|-------|-----------|------------|
| Editar solo durante la primera hora | `lib/limits.js` → `editWindow()` | `proteger_edicion_incidencia` |
| El cierre necesita palabras para el ciudadano | `services/reports.js` → `MIN_MENSAJE_FINAL` | `proteger_edicion_incidencia` |
| Reasignar technicians | `services/asignaciones.js` | RPC `asignar_tecnico` |
| Los avisos los manda el municipio, no el usuario | — | tabla `notificaciones`, sin política de `INSERT` |
| Nadie cambia su propio rol ni su código | — | `proteger_perfil` |
| Nadie se registra como administrador | — | `handle_new_user` escribe siempre `Ciudadano` |
| Solo un administrador crea personal | `screens/UsersScreen.js` | Edge Function `admin-create-user` |
| Cada quien solo ve lo suyo | — | políticas RLS |
| Un código de cuenta identifica a una sola persona | — | índice `profiles_codigo_unico` |

### Dos detalles que sorprenden

**Dentro de una función marcada `security definer`** (que es casi todo lo
de este proyecto), `current_user` es **el dueño de la función**, no quien
la llama. Por eso los disparadores leen el rol del JWT y no de
`current_user`: usar `current_user` haría que la comprobación valiera
siempre y desactivaría la protección sin avisar.

**Un trigger no puede ser la única defensa si estorba al panel.** El SQL
Editor abre una conexión directa a la base, sin ninguna petición de la API
detrás y sin `request.jwt.claims`. Un disparador que solo mirara el claim
trataría esa conexión como si fuera un usuario cualquiera, y dejaría al
municipio sin poder ni reparar un dato ni ejecutar el propio script. Por eso
`proteger_perfil` distingue las tres situaciones: si no hay claims, no hay
petición de API, así que deja pasar. Las pruebas de esto viven en
`pruebas/panel.sql`.

## Prueba manual, de punta a punta

Con las cuatro filas de la base en ✓, esta lista sirve para confirmar que
la app se comporta. Conviene hacerla con los tres roles.

### Las cuentas

0. En la pantalla de bienvenida, **Crear cuenta** registra a un ciudadano.
   Al entrar, su rol es `Ciudadano` y no hay forma de elegir otro. Si el
   proyecto tiene la confirmación de correo activada, la app avisa y la
   cuenta entra recién cuando confirma.
0b. Como administrador: **Personal** → crea un técnico con un código libre.
   La cuenta aparece en la lista, y ese técnico ya puede entrar con su
   código o con su correo. Si la app dice que la función
   `admin-create-user` no está desplegada, es el paso 2 de
   [`../LEEME_CUENTAS_Y_ROLES.md`](../LEEME_CUENTAS_Y_ROLES.md).

### Como ciudadano

1. Entra con tu código de acceso y envía un reporte.
2. El reporte sale en «Mis reportes» con la cuenta atrás `⏱ Puedes
   corregirlo 59 min más`. Ábrelo y corrige la descripción: funciona.
3. Avisa a alguien que espere 1 hora (o pide al admin que pase el
   reporte a «En proceso»): el botón de editar desaparece y dice por
   qué. Intentar guardarlo a mano por la API también se rechaza.

### Como administrador

4. Entra con `ADM-0001`. «Todos los reportes» debe listar lo que hay, y
   debe ser la lista más larga de las tres.
5. Pulsa **✚ Asignar técnico**. El técnico recibe un aviso en su bandeja
   y el reporte muestra su nombre.
6. Vuelve a abrir **⇄ Cambiar técnico** y cámbialo por otro, escribiendo
   un motivo. En el reporte aparece un bloque **CAMBIO DE TÉCNICO**:
   «Este reporte fue reasignado 1 vez. Lo atendía Luis y ahora está a
   cargo de Carmen», con el motivo debajo.
7. Cambia el estado a «En proceso» y luego a «Resuelto».

### Como técnico

8. Entra con `TEC-0001`. Solo debes ver los reportes que te asignaron.
9. **Llenar informe**: describe el trabajo, anota los materiales, sube una
   foto.
10. Al cerrar te pide el resultado —*Resuelto*, *No se resolvió*,
    *Hacía falta maquinaria*, *No era de mi competencia* o *El reporte
    estaba equivocado*— y **unas palabras para el ciudadano**. Con menos
    de 10 caracteres no te deja cerrar.
11. Cierra. El ciudadano recibe el aviso y su reporte muestra el mensaje
    del técnico con la fecha.

### La bandeja de avisos

12. La campana de la cabecera, a la derecha del título, muestra un contador
    con los avisos sin leer. La lista se refresca sola cada 25 segundos,
    así que no hace falta recargar la pantalla.
13. Los avisos que debería haber recibido cada quien:

| Quién | Cuándo |
|-------|--------|
| Administrador | Alguien envía un reporte nuevo |
| Técnico | Le asignan un reporte, o se lo cambian |
| Ciudadano | Resolvieron su reporte, o le cambiaron el técnico |

### El botón «Información»

14. Con cualquiera de los tres roles, la tarjeta **Información** de la
    pantalla de inicio abre una ventana centrada que explica qué hace la
    aplicación, qué puede hacer ese rol en concreto y qué se acaba de
    cambiar. Se cierra con **Entendido** o tocando fuera.

### Lo que ninguno puede saltarse

- Un ciudadano **no puede** editar el reporte de otro.
- Un ciudadano **no puede** escribirse avisos a sí mismo: la bandeja solo
  la llenan los disparadores.
- Un ciudadano **no puede** ascenderse a `Administrador` ni fabricarse un
  código `TEC-` cambiando su perfil, aunque llame a la API directamente.
- Dos cuentas **no pueden** compartir código de acceso.
- Reasignar al técnico que ya lo tiene se rechaza: no es un cambio y no
  generaría un aviso.
