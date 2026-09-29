// Prueba de la ventana de edición. La regla aparece por duplicado (en la
// app y en el trigger de Postgres) y este archivo comprueba que la de la
// app dice lo que debe decir, incluido el momento exacto del límite.
const assert = require('assert');
const path = require('path');

const {
  editWindow,
  formatRemaining,
  EDIT_WINDOW_HOURS,
  LIMITS,
} = require(path.resolve(process.argv[2], 'src/lib/limits.js'));

const HORA = 3_600_000;
const base = Date.parse('2026-09-28T10:00:00Z');
const casos = [];

// El límite de la ventana.
casos.push([
  'recién enviado: editable',
  editWindow({ status: 'Pendiente', created_at: '2026-09-28T10:00:00Z' }, base),
  (r) => r.editable === true && r.remainingMs === EDIT_WINDOW_HOURS * HORA,
]);

casos.push([
  'justo al cumplirse la hora: bloqueado',
  editWindow({ status: 'Pendiente', created_at: '2026-09-28T10:00:00Z' }, base + EDIT_WINDOW_HOURS * HORA),
  (r) => r.editable === false && r.remainingMs === 0 && /1 hora/.test(r.reason),
]);

casos.push([
  'un segundo antes: aún editable',
  editWindow({ status: 'Pendiente', created_at: '2026-09-28T10:00:00Z' }, base + EDIT_WINDOW_HOURS * HORA - 1000),
  (r) => r.editable === true && r.remainingMs === 1000,
]);

// El estado manda sobre la hora: si el municipio ya lo tomó, no hay nada
// que esperar aunque la hora siga corriendo.
for (const estado of ['En proceso', 'Resuelto']) {
  casos.push([
    `estado ${estado}: bloqueado aunque falte hora`,
    editWindow({ status: estado, created_at: '2026-09-28T10:00:00Z' }, base + 60_000),
    (r) => r.editable === false && new RegExp(estado).test(r.reason),
  ]);
}

// Sin fecha de creación: se deja escribir y decide el servidor.
casos.push([
  'sin created_at: editable con la marca unknown',
  editWindow({ status: 'Pendiente', created_at: null }, base),
  (r) => r.editable === true && r.unknown === true,
]);

casos.push([
  'reporte inexistente: bloqueado sin romper',
  editWindow(null, base),
  (r) => r.editable === false && !!r.reason,
]);

// Formato de la cuenta atrás.
casos.push(['0 ms -> 0 min', formatRemaining(0), (v) => v === '0 min']);
casos.push(['30 s -> 30 s', formatRemaining(30_000), (v) => v === '30 s']);
casos.push(['59 min', formatRemaining(59 * 60_000), (v) => v === '59 min']);
casos.push(['60 min -> 1 h', formatRemaining(60 * 60_000), (v) => v === '1 h']);
casos.push(['90 min -> 1 h 30 min', formatRemaining(90 * 60_000), (v) => v === '1 h 30 min']);
casos.push(['negativo -> 0 min', formatRemaining(-5000), (v) => v === '0 min']);

// Los límites de texto coinciden con los CHECK de Postgres.
casos.push([
  'LIMITS.mensajeFinal = 300, como el CHECK del servidor',
  LIMITS.mensajeFinal,
  (v) => v === 300,
]);
casos.push([
  'LIMITS.motivoReasignacion = 200, como el recorte del RPC',
  LIMITS.motivoReasignacion,
  (v) => v === 200,
]);

let fallos = 0;
for (const [nombre, valor, comprueba] of casos) {
  try {
    assert.ok(comprueba(valor), `no se cumplió: ${JSON.stringify(valor)}`);
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    console.log(`  FALLA ${nombre}\n        ${e.message}`);
    fallos++;
  }
}

console.log(
  fallos === 0
    ? `\nOK · ${casos.length} comprobaciones de la ventana de edición`
    : `\n${fallos} fallo(s) de ${casos.length}`
);
process.exit(fallos === 0 ? 0 : 1);
