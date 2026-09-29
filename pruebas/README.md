# Pruebas

Comprobaciones automáticas del proyecto. Se ejecutan con:

```bash
bash pruebas/verificar-todo.sh
```

No necesita el proyecto de Supabase: levanta un Postgres descartable en
`/tmp/pruebas-incidencias` y corre los scripts de `supabase/` contra él.
Al terminar se puede apagar con:

```bash
pg_ctl -D /tmp/pruebas-incidencias/pgdata stop
```

## Qué comprueba cada cosa

| Archivo | Qué mira |
|---------|----------|
| `test-ventana.js` | La ventana de 1 hora: el límite exacto, y que el estado la corte antes que el reloj |
| `test-asignaciones.js` | El resumen del historial de reasignaciones que lee el ciudadano |
| `test-consistencia.js` | Que la app y el servidor admitan lo mismo: categorías, estados, cierres, tipos de aviso y todos los límites numéricos |
| `check-styles.js` | Que ningún `styles.X` apunte a un estilo que no existe |
| `check-imports.js` | Que todos los imports resuelvan a algo real |
| `check-unused-styles.js` | Estilos definidos y nunca usados |
| `andamiaje.sql` | Imita lo mínimo de Supabase (`auth.users`, `storage`, `auth.uid()`) para poder correr los scripts fuera de él |
| `pruebas.sql` | El comportamiento de los tres roles contra la base real |
| `idempotencia.sql` | Que los scripts se puedan volver a ejecutar sin romper nada |
| `panel.sql` | Que el SQL Editor pueda seguir manteniendo los datos a mano |

## Las cuentas y el panel

`panel.sql` se ejecuta en una sesión de psql aparte, y eso es la gracia:
el SQL Editor abre una conexión nueva donde **no existe**
`request.jwt.claims`, porque no hay ninguna petición de la API detrás.
`pruebas.sql`, en cambio, corre con el claim puesto, que es el caso de la
app. Son las dos mitades de la misma regla y cada una necesita su contexto.

Antes de correr `panel.sql`, `verificar-todo.sh` planta el problema real que
se quiere comprobar: tira el índice único y deja dos cuentas con el mismo
código, y después reejecuta `schema.sql`. Si el script no limpiara los
repetidos, el `CREATE INDEX` reventaría y dejaría el schema a medias.

Dos cosas que hay que tener en cuenta al escribir estas pruebas, porque no
son evidentes:

- **El andamiaje solo borra el esquema `public`.** Las filas de
  `auth.users` sobreviven entre corridas, así que una prueba que da de alta
  una cuenta tiene que borrar la suya antes de empezar. Si no, el `INSERT`
  no hace nada, el trigger que crea el perfil no se dispara y las
  comprobaciones de abajo pasan en verde sin haber escrito nada.
- **Una prueba de bloqueo tiene que llegar al trigger.** Un `UPDATE` sobre
  una fila ajena afecta a 0 filas porque RLS lo frena antes, así que no
  lanzaría ningún error y `prueba_bloqueo` no probaría nada. Las pruebas de
  citizenidad van sobre la fila del propio ciudadano.

## Por qué hay una base de datos aquí

Las reglas que importan —quién ve qué, quién puede editar, quién cambia
el rol de un usuario— no se comprueban leyendo el código, sino
ejecutándolo. Con solo las comprobaciones estáticas se podría tener un
`proteger_edicion_incidencia` lleno de errores de sintaxis SQL y no
enterarse.

## Un detalle sobre `pruebas.sql`

Las pruebas cambian a `set role authenticated`, igual que hace PostgREST.
Corriendolas como `postgres` no serviría de nada: el dueño de una tabla
ignora sus propias políticas RLS, así que todas las comprobaciones de
aislamiento pasarían siempre y no comprobarían nada. La prueba 0 existe
justo para dejar eso claro y detectar que el arnés está bien.

Por la misma razón `como_superusuario()` limpia el claim del JWT antes de
actuar: si se dejara puesto, el disparador creería que es el ciudadano y
bloquearía las pruebas que quieren reparar datos a mano.
