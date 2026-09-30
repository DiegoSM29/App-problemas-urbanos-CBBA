#!/usr/bin/env bash
# Ejecuta todas las comprobaciones del proyecto y resume el resultado.
#
#   1. Reglas puras de la app (ventana de edición, filtros del mapa,
#      historial de reasignaciones, reportes duplicados)
#   2. Coherencia entre la app y el servidor (categorías, estados, límites)
#   3. Comprobaciones estáticas (estilos sin definir, imports rotos)
#   4. Los scripts SQL contra un Postgres real, con su batería de
#      comportamiento de los tres roles
#   5. Que los scripts se puedan volver a ejecutar sin romper nada
#   6. Que el script repare una base con códigos repetidos y que el panel
#      pueda seguir manteniendo los datos a mano
#
# Uso:  bash pruebas/verificar-todo.sh

set -uo pipefail

# Este script vive en pruebas/, y el proyecto un nivel arriba.
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/.." && pwd)"

# La base de datos descartable se guarda aparte del proyecto: son cientos
# de megabytes que no van en el repositorio.
TRABAJO="${PRUEBAS_TMP:-/tmp/pruebas-incidencias}"
PGDATA="$TRABAJO/pgdata"
PUERTO="${PRUEBAS_PUERTO:-55432}"
SOCK="$TRABAJO"
mkdir -p "$TRABAJO"

fallos=0
titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()     { printf '  \033[32m%s\033[0m\n' "$1"; }
mal()    { printf '  \033[31m%s\033[0m\n' "$1"; fallos=$((fallos+1)); }

# ---------------------------------------------------------------------
# 1 y 2. Las reglas de la app
# ---------------------------------------------------------------------
titulo "1. Reglas de la app"
if node "$AQUI/test-ventana.js" "$RAIZ" | sed 's/^/  /'; then :; else mal "reglas de la ventana de edición"; fi

if node "$AQUI/test-filtros.js" "$RAIZ" | sed 's/^/  /'; then :; else mal "reglas de los filtros del mapa"; fi

if node "$AQUI/test-duplicados.js" "$RAIZ" | sed 's/^/  /'; then :; else mal "regla de reportes duplicados"; fi

titulo "2. La app y el servidor cuentan lo mismo"
if node "$AQUI/test-consistencia.js" "$RAIZ" | sed 's/^/  /'; then :; else mal "coherencia app/servidor"; fi

# ---------------------------------------------------------------------
# 3. Comprobaciones estáticas
# ---------------------------------------------------------------------
titulo "3. Comprobaciones estáticas"
for comprobacion in check-styles check-imports check-unused-styles; do
  archivo="$AQUI/$comprobacion.js"
  [ -f "$archivo" ] || continue
  if salida=$(node "$archivo" "$RAIZ/src" 2>&1); then
    ok "$(echo "$salida" | tail -1)"
  else
    echo "$salida" | sed 's/^/    /'
    mal "  $comprobacion"
  fi
done

# ---------------------------------------------------------------------
# 4 y 5. El servidor
# ---------------------------------------------------------------------
titulo "4. Los scripts SQL contra un Postgres real"

# El script crea el cluster la primera vez; si ya existe de una corrida
# anterior, se reutiliza tal cual.
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "  creando el cluster de Postgres en $PGDATA ..."
  initdb -D "$PGDATA" -A trust -U postgres >/dev/null 2>&1 \
    || { echo "  no se pudo crear el cluster"; exit 1; }
fi

if ! pg_isready -h "$SOCK" -p "$PUERTO" -q 2>/dev/null; then
  echo "  arrancando Postgres descartable..."
  pg_ctl -D "$PGDATA" -l "$TRABAJO/pg.log" \
    -o "-k $SOCK -p $PUERTO -c listen_addresses=''" start >/dev/null 2>&1
  sleep 3
fi

Q() { psql -h "$SOCK" -p "$PUERTO" -U postgres -q "$@"; }

# Base limpia: sin esto las pruebas de una corrida se mezclan con las de
# la anterior y los conteos no cuadran.
Q -c "drop schema if exists public cascade; create schema public;" >/dev/null 2>&1
Q -f "$AQUI/andamiaje.sql" >/dev/null 2>&1 || mal "no se pudo crear el andamiaje"

for script in schema notificaciones; do
  if Q -f "$RAIZ/supabase/$script.sql" >/dev/null 2>&1; then
    ok "supabase/$script.sql se ejecuta sin errores"
  else
    mal "supabase/$script.sql falla al ejecutarse"
    Q -f "$RAIZ/supabase/$script.sql" 2>&1 | tail -5 | sed 's/^/        /'
  fi
done

Q -c "grant all on all tables in schema auth to anon, authenticated, service_role;" >/dev/null 2>&1

# El diagnóstico que también se le pide al usuario.
if Q -f "$RAIZ/supabase/verificar.sql" >/dev/null 2>&1; then
  ok "supabase/verificar.sql se ejecuta sin errores"
else
  mal "supabase/verificar.sql falla al ejecutarse"
fi

echo
echo "  Comportamiento de los tres roles:"
# La batería necesita datos: crea usuarios, reportes, asignaciones y
# avisos. Se guarda aparte porque el paso 5 los necesita intactos.

# Se corre una sola vez y se guarda la salida: repetir la batería daría
# conteos distintos y podría dar un veredicto distinto al real.
salida=$(Q -f "$AQUI/pruebas.sql" 2>&1)
resumen() {
  echo "$salida" \
    | grep -E "ok  |FALLA|ERROR" \
    | sed -e 's/^NOTICE:  //' -e 's/^psql:[^:]*:[0-9]*: //' -e 's/^/    /'
}

if echo "$salida" | grep -qE "FALLA|ERROR"; then
  resumen
  mal "hay comprobaciones de comportamiento que fallan"
else
  ok "$(echo "$salida" | grep -cE 'ok  ') comprobaciones de comportamiento correctas"
fi

titulo "5. Los scripts se pueden volver a ejecutar"
salida=$(cd "$RAIZ" && psql -h "$SOCK" -p "$PUERTO" -U postgres -q -f "$AQUI/idempotencia.sql" 2>&1)
if echo "$salida" | grep -qE "FALLA|ERROR"; then
  echo "$salida" | grep -E "ok  |FALLA|ERROR" | sed -e 's/^NOTICE:  //' -e 's/^/    /'
  mal "reejecutar los scripts no es seguro"
else
  ok "$(echo "$salida" | grep -cE 'ok  ') comprobaciones tras reejecutar"
fi

# ---------------------------------------------------------------------
# 6. El panel puede mantener los datos a mano
# ---------------------------------------------------------------------
# Primero se planta el desastre que daría problemas de verdad: una base con
# códigos repetidos y sin el índice único. Si el script no supiera
# limpiarlos, el CREATE INDEX reventaría y dejaría el schema a medias.
titulo "6. El panel repara una base con códigos repetidos"

if Q -c "
  drop index if exists public.profiles_codigo_unico;
  update public.profiles set codigo = 'TEC-0500'
   where codigo in ('TEC-0001', 'TEC-0002');
" >/dev/null 2>&1; then
  ok "se plantaron dos cuentas con el mismo código"
else
  mal "no se pudo preparar la base con códigos repetidos"
fi

# Y se reejecuta el schema, que es lo que hará el usuario desde el panel.
if Q -f "$RAIZ/supabase/schema.sql" >/dev/null 2>&1; then
  ok "supabase/schema.sql limpia los repetidos y crea el índice"
else
  mal "supabase/schema.sql falla con códigos repetidos"
  Q -f "$RAIZ/supabase/schema.sql" 2>&1 | tail -5 | sed 's/^/        /'
fi

# Las pruebas del panel van en sesión aparte a propósito: así request.jwt.claims
# no está puesto, que es exactamente lo que pasa en el SQL Editor.
salida=$(Q -f "$AQUI/panel.sql" 2>&1)
if echo "$salida" | grep -qE "FALLA|ERROR"; then
  echo "$salida" | grep -E "ok  |FALLA|ERROR" | sed -e 's/^NOTICE:  //' -e 's/^psql:[^:]*:[0-9]*: //' -e 's/^/    /'
  mal "el panel no puede mantener los datos a mano"
else
  ok "$(echo "$salida" | grep -cE 'ok  ') comprobaciones del panel"
fi

# ---------------------------------------------------------------------
titulo ""
if [ "$fallos" -eq 0 ]; then
  printf '\033[32mTodo en orden.\033[0m\n\n'
else
  printf '\033[31m%d cosa(s) por revisar.\033[0m\n\n' "$fallos"
fi
exit "$fallos"
