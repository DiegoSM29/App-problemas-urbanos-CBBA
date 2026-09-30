// Compara lo que la app da por hecho con lo que el servidor realmente
// acepta. Estas reglas están escritas dos veces: en el CHECK de Postgres
// y en src/lib/limits.js. Es inevitable (el cliente no puede leer la base),
// pero por eso justamente hay que compararlas: si divergen, el usuario
// escribe algo que la app permite y el servidor lo rechaza (o al revés),
// y el error sale en el peor momento.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(process.argv[2]);
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

const schema = leer('supabase/schema.sql');
const notificaciones = leer('supabase/notificaciones.sql');
const limits = leer('src/lib/limits.js');
const colors = leer('src/theme/colors.js');
const duplicados = leer('src/lib/duplicados.js');

// Saca la lista de valores de un CHECK de la forma
//   check (columna in ('a', 'b', 'c'))
//
// Algunas columnas aceptan además NULL y lo escriben como
// "columna is null or columna in (...)", así que el patrón no puede
// exigir que la lista empiece justo después del paréntesis.
function valoresDelCheck(sql, tabla, columna) {
  const re = new RegExp(
    `add constraint ${tabla}_${columna}_check\\s*\\n?\\s*check \\([^)]*?${columna} in \\(([^)]*)\\)`,
    'i'
  );
  const m = sql.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

// Saca las claves de un objeto literal del estilo
//   const TIPOS = { clave: {...}, ... }
// Se ignoran las comillas: lo que importa son los nombres de las claves.
function clavesDeObjeto(texto) {
  const m = texto.match(/=\s*\{([\s\S]*?)\n\};?/);
  if (!m) return null;
  return [...m[1].matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map((x) => x[1]);
}

// Saca una constante numérica exportada del archivo de límites.
function numeroDeLimits(nombre) {
  const m = limits.match(new RegExp(`${nombre}:\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

// MIN_MENSAJE_FINAL vive en el servicio de reportes, no en limits.js,
// porque es una regla del cierre y no un límite de un campo de texto.
function minMensajeFinal() {
  const reports = leer('src/services/reports.js');
  const m = reports.match(/MIN_MENSAJE_FINAL\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// Lo mismo para el motivo de la reapertura: es una regla del formulario,
// no un límite de un campo, así que vive junto a la anterior.
function minMotivoReapertura() {
  const reports = leer('src/services/reports.js');
  const m = reports.match(/MIN_MOTIVO_REAPERTURA\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

const casos = [];

// ---------------------------------------------------------------
// Categorías: el menú de la app y el CHECK de la tabla
// ---------------------------------------------------------------
casos.push([
  'las categorías del CHECK de Postgres',
  valoresDelCheck(schema, 'incidencias', 'category'),
  (v) => v !== null,
]);

casos.push([
  'las categorías del menú de la app',
  (() => {
    const m = colors.match(/export const categories = \[([\s\S]*?)\];/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).filter((c) => c !== 'Todos');
  })(),
  (v) => v !== null,
]);

// ---------------------------------------------------------------
// Estados: los tres que la app muestra y los que acepta la tabla
// ---------------------------------------------------------------
casos.push([
  'los estados del CHECK de Postgres',
  valoresDelCheck(schema, 'incidencias', 'status'),
  (v) => v !== null,
]);

casos.push([
  'los estados de la app',
  (() => {
    const m = colors.match(/export const statuses = \[([\s\S]*?)\];/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  })(),
  (v) => v !== null,
]);

// ---------------------------------------------------------------
// Resultados de cierre: CIERRES en limits.js y el CHECK de la tabla
// ---------------------------------------------------------------
// El CHECK de cierre_resultado admite NULL, así que el patrón tiene que
// tolerar el "is null or". Sin eso la lista saldría vacía y la
// comparación no probaría nada.
casos.push([
  'los resultados de cierre del CHECK',
  valoresDelCheck(schema, 'incidencias', 'cierre_resultado'),
  (v) => v !== null,
]);

casos.push([
  'los resultados de cierre de la app (CIERRES)',
  (() => {
    const m = limits.match(/export const CIERRES = \[([\s\S]*?)\];/);
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  })(),
  (v) => v !== null,
]);

// ---------------------------------------------------------------
// Tipos de notificación: los que escribe la base y los que la app
// sabe pintar. Si aparece un tipo nuevo en el servidor y la app no lo
// conoce, se vería un aviso sin icono ni color.
// ---------------------------------------------------------------
casos.push([
  'los tipos de aviso del servidor',
  (() => {
    // El CHECK no vive dentro del create table (para poder ampliarlo sin
    // reescribir la tabla), sino en un alter posterior.
    const m = notificaciones.match(
      /add constraint notificaciones_tipo_check\s+check \(tipo in \(([^)]*)\)\)/i
    );
    if (!m) return null;
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  })(),
  (v) => v !== null,
]);

// ---------------------------------------------------------------
// Límites numéricos: los mismos números en los dos lados
// ---------------------------------------------------------------
const limites = [
  ['mensajeFinal', 300],
  ['motivoReasignacion', 200],
  ['motivoReapertura', 300],
];
for (const [nombre, esperado] of limites) {
  casos.push([
    `LIMITS.${nombre} = ${esperado}`,
    numeroDeLimits(nombre),
    (v) => v === esperado,
  ]);
}

// El recorte de texto en el servidor debe coincidir con el del cliente.
casos.push([
  'el recorte de motivo en el RPC usa el mismo ancho que la app',
  (() => {
    const m = notificaciones.match(/left\(v_motivo,\s*(\d+)\)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === numeroDeLimits('motivoReasignacion'),
]);

casos.push([
  'el recorte de mensaje_final usa el mismo ancho que la app',
  (() => {
    const m = schema.match(/left\(mensaje_final,\s*(\d+)\)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === numeroDeLimits('mensajeFinal'),
]);

// El mínimo de caracteres del mensaje de cierre, por los dos lados.
casos.push([
  'el mínimo de 10 caracteres también está en el cliente',
  minMensajeFinal(),
  (v) => v === 10,
]);

casos.push([
  'y en el trigger del servidor',
  (() => {
    const m = schema.match(/char_length\(btrim\(new\.mensaje_final\)\) < (\d+)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 10,
]);

// ---------------------------------------------------------------
// La reapertura: mismos números en el formulario y en el trigger
// ---------------------------------------------------------------
casos.push([
  'el mínimo del motivo de reapertura en el cliente',
  minMotivoReapertura(),
  (v) => v === 10,
]);

casos.push([
  'y en el trigger del servidor',
  (() => {
    const m = schema.match(
      /char_length\(btrim\(new\.reapertura_motivo\)\) < (\d+)/
    );
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 10,
]);

// El recorte del motivo lo hace el trigger (left(..., 300)), igual que el
// mensaje de cierre. Si divergieran, un motivo que la app deja escribir
// rebotaría contra el CHECK de la base.
casos.push([
  'el recorte de reapertura usa el mismo ancho que la app',
  (() => {
    const m = schema.match(/left\(btrim\(new\.reapertura_motivo\),\s*(\d+)\)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === numeroDeLimits('motivoReapertura'),
]);

// El RPC del mapa es la puerta por la que un ciudadano ve los reportes de
// otros. Si aparece una columna nueva ahí, tiene que existir también en
// la app (mapPin) o el pin saldría con un hueco.
//
// El tipo puede tener dos palabras ("double precision"), así que el patrón
// acepta espacios y no solo un identificador.
function columnasDelMapa() {
  const m = schema.match(
    /create or replace function public\.mapa_incidencias\(\)[\s\S]*?returns table \(([\s\S]*?)\)/
  );
  if (!m) return null;
  return [...m[1].matchAll(/^\s*([a-z_]+)\s+[a-z ]+,?\s*$/gm)].map((x) => x[1]);
}

casos.push([
  'el mapa expone ocho columnas, las mismas que lee la app',
  columnasDelMapa(),
  (v) =>
    Array.isArray(v) &&
    v.length === 8 &&
    ['id', 'title', 'category', 'place', 'status', 'lat', 'lng', 'created_at'].every(
      (c) => v.includes(c)
    ),
]);

// Y ninguna de esas columnas puede ser contenido privado: el informe, los
// materiales, el mensaje del técnico y el dueño son de otra persona.
casos.push([
  'el mapa no expone ni informe, materiales, mensaje ni dueño',
  columnasDelMapa(),
  (v) =>
    Array.isArray(v) &&
    !['informe', 'materiales', 'mensaje_final', 'user_id', 'tecnico_nombre', 'image_url'].some(
      (c) => v.includes(c)
    ),
]);

// ---------------------------------------------------------------
// La ventana de edición: 1 hora en la app, 1 hora en el trigger
// ---------------------------------------------------------------
casos.push([
  'la ventana de edición en la app',
  (() => {
    const m = limits.match(/EDIT_WINDOW_HOURS\s*=\s*(\d+)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 1,
]);

casos.push([
  'la ventana de edición en el trigger',
  (() => {
    const m = schema.match(/interval '(\d+) hour'/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 1,
]);

// ---------------------------------------------------------------
// Los reportes duplicados: mismos números en la app y en el trigger
// ---------------------------------------------------------------
// La app avisa antes de enviar y la base lo rechaza igual. Si los dos lados
// midieran distinto, el resultado sería el peor de los dos: un reporte a 29,9
// metros pasaría el aviso de la app y reventaría contra el servidor, con un
// error que el ciudadano no entiende. Por eso el radio y la frase del aviso
// están escritos dos veces y aquí se comparan.

casos.push([
  'el radio de duplicados en la app',
  (() => {
    const m = duplicados.match(/RADIO_DUPLICADO_M\s*=\s*(\d+)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 30,
]);

casos.push([
  'el radio de duplicados en el trigger del servidor',
  (() => {
    const m = schema.match(/v_radio_m constant double precision := (\d+)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 30,
]);

// La fórmula de la distancia también tiene que ser la misma: el radio de la
// Tierra es el número del que salen los metros en los dos lados.
casos.push([
  'el radio de la Tierra en la app',
  (() => {
    const m = duplicados.match(/RADIO_TIERRA_M\s*=\s*(\d+)/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 6371000,
]);

casos.push([
  'el radio de la Tierra en el trigger del servidor',
  (() => {
    const m = schema.match(/2 \* (\d+) \* asin\(/);
    return m ? Number(m[1]) : null;
  })(),
  (v) => v === 6371000,
]);

// El aviso que ve el ciudadano lo escriben los dos: la app, para el aviso
// previo, y el trigger, para cuando la comprobación previa no pudo ver el
// reporte del vecino (que se acaba de mandar). La primera frase se compara
// tal cual; si divergen, el cliente dejaría de reconocer el error del
// servidor y lo mostraría como un fallo cualquiera.
casos.push([
  'la frase del aviso de duplicado en el trigger',
  (() => {
    const m = schema.match(/'(Ya hay un reporte de esta categoría[^']*?)%s metros/);
    return m ? m[1].trim() : null;
  })(),
  (v) =>
    v === ((m) => (m ? m[1] : null))(duplicados.match(/AVISO_DUPLICADO\s*=\s*'([^']*)'/)),
]);

let fallos = 0;
const fallo = (n) => {
  console.log(`  FALLA ${n}`);
  fallos++;
};

// Primero, los que se comparan entre sí.
const porNombre = new Map(casos.map(([n, v]) => [n, v]));

function comprobar(etiqueta, a, b) {
  if (!a || !b) return fallo(`${etiqueta}: no se pudo leer uno de los dos lados`);
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) {
    console.log(`  ok    ${etiqueta} → ${a.length} valores iguales`);
  } else {
    console.log(`  FALLA ${etiqueta}`);
    console.log(`          app/servidor A: ${sa}`);
    console.log(`          app/servidor B: ${sb}`);
    const soloA = a.filter((x) => !b.includes(x));
    const soloB = b.filter((x) => !a.includes(x));
    if (soloA.length) console.log(`          solo en A: ${soloA.join(', ')}`);
    if (soloB.length) console.log(`          solo en B: ${soloB.join(', ')}`);
    fallos++;
  }
}

comprobar(
  'categorías: app = CHECK de Postgres',
  porNombre.get('las categorías del menú de la app'),
  porNombre.get('las categorías del CHECK de Postgres')
);
comprobar(
  'estados: app = CHECK de Postgres',
  porNombre.get('los estados de la app'),
  porNombre.get('los estados del CHECK de Postgres')
);
comprobar(
  'cierres: app = CHECK de Postgres',
  porNombre.get('los resultados de cierre de la app (CIERRES)'),
  porNombre.get('los resultados de cierre del CHECK')
);

// Los valores sueltos.
for (const [nombre, , comprueba] of casos) {
  if (!nombre.includes(': app =') && !nombre.includes('= CHECK')) {
    const valor = porNombre.get(nombre);
    try {
      assert.ok(comprueba(valor), `valor inesperado: ${JSON.stringify(valor)}`);
      console.log(`  ok    ${nombre}`);
    } catch (e) {
      fallo(`${nombre} → ${e.message}`);
    }
  }
}

// Los tipos de aviso: el servidor define los nombres y la app les pone
// icono y color. Si el servidor emite un tipo que la app no conoce, el
// aviso llega a la bandeja sin icono ni color, que es peor que no
// llegar: parece un error.
// La comparación va en los dos sentidos. Sobrar en la app no molesta
// (un tipo retirado sigue descrito, es inofensivo), pero faltaría
// señalarlo por si se acumula.
const tiposServidor = porNombre.get('los tipos de aviso del servidor');
const tiposApp = clavesDeObjeto(leer('src/services/notifications.js'));

if (!tiposServidor) {
  fallo('no se pudo leer la lista de tipos de aviso del servidor');
} else if (!tiposApp || !tiposApp.length) {
  fallo('no se pudo leer el mapa de tipos de aviso de la app');
} else {
  comprobar('tipos de aviso: app = CHECK del servidor', tiposApp, tiposServidor);

  const sobran = tiposApp.filter((t) => !tiposServidor.includes(t));
  if (sobran.length) {
    console.log(
      `  nota la app describe ${sobran.length} tipo(s) que el servidor ya no emite: ${sobran.join(', ')}`
    );
  }
}

console.log(
  fallos === 0
    ? '\nOK · la app y el servidor cuentan lo mismo'
    : `\n${fallos} discrepancia(s) entre la app y el servidor`
);
process.exit(fallos === 0 ? 0 : 1);
