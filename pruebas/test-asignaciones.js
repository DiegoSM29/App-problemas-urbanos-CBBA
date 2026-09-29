// Prueba del resumen del historial de reasignaciones. Es el texto que lee
// el ciudadano en su reporte, así que importa distinguir "nunca cambió"
// de "cambió una vez" y de "cambió varias".
const assert = require('assert');
const path = require('path');

// El archivo usa imports sin extensión, que Node en modo ESM no resuelve.
// Para probar solo la función pura se extrae su texto y se evalúa, sin
// arrancar supabase-js.
const fs = require('fs');
const fuente = fs.readFileSync(
  path.resolve(process.argv[2], 'src/services/asignaciones.js'),
  'utf8'
);

const inicio = fuente.indexOf('export function summarizeAssignments');
if (inicio === -1) throw new Error('no se encontró summarizeAssignments');

// Se compila el cuerpo con un `return` explícito y se invoca una sola vez:
// el ámbito de `new Function` es propio, así que pedir la función dos veces
// no devuelve el mismo binding.
const summarizeAssignments = new Function(
  `${fuente.slice(inicio).replace('export function', 'function')}\nreturn summarizeAssignments;`
)();

// El servicio no se puede cargar tal cual en Node porque importa
// supabase-js; se extrae solo la función para poder probarla.
const asign = (rol, nombre, extra = {}) => ({
  rol,
  tecnico_nombre: nombre,
  time: '28/09/2026, 10:00',
  motivo: null,
  ...extra,
});

const casos = [
  [
    'sin asignaciones: no se muestra nada',
    summarizeAssignments([]),
    (r) => r === null,
  ],
  [
    'solo asignación inicial: no se muestra nada',
    summarizeAssignments([asign('asignacion', 'Luis')]),
    (r) => r === null,
  ],
  [
    'una reasignación: dice de quién a quién',
    summarizeAssignments([
      asign('asignacion', 'Luis'),
      asign('reasignacion', 'Carmen', { motivo: 'No tenía materiales' }),
    ]),
    (r) =>
      r.huboCambio === true &&
      r.total === 1 &&
      r.de === 'Luis' &&
      r.a === 'Carmen' &&
      r.motivo === 'No tenía materiales',
  ],
  [
    'varias reasignaciones: cuenta el total y describe el último cambio',
    // Luis → Carmen → Diego → Sofía. Lo que le interesa al ciudadano es
    // quién lo tiene ahora y quién lo tenía justo antes, no la cadena
    // entera, así que se resumen los dos últimos.
    summarizeAssignments([
      asign('asignacion', 'Luis'),
      asign('reasignacion', 'Carmen'),
      asign('reasignacion', 'Diego'),
      asign('reasignacion', 'Sofía'),
    ]),
    (r) => r.total === 3 && r.de === 'Diego' && r.a === 'Sofía',
  ],
  [
    'reasignación sin motivo: el texto no lo inventa',
    summarizeAssignments([
      asign('asignacion', 'Luis'),
      asign('reasignacion', 'Carmen', { motivo: null }),
    ]),
    (r) => r.motivo === null,
  ],
  [
    'desasignación no cuenta como cambio de técnico',
    summarizeAssignments([
      asign('asignacion', 'Luis'),
      asign('desasignacion', null),
    ]),
    (r) => r === null,
  ],
  [
    'nombres ausentes: no rompe con undefined',
    summarizeAssignments([asign('asignacion', null), asign('reasignacion', null)]),
    (r) => r.huboCambio === true && r.de == null && r.a == null,
  ],
  [
    'null completo: no rompe',
    summarizeAssignments(null),
    (r) => r === null,
  ],
];

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
    ? `\nOK · ${casos.length} comprobaciones del historial de reasignaciones`
    : `\n${fallos} fallo(s) de ${casos.length}`
);
process.exit(fallos === 0 ? 0 : 1);
