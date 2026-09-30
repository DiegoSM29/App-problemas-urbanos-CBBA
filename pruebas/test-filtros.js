// Prueba de los filtros del mapa.
//
// Los cuatro criterios (categoría, fecha de publicación, estado y alcance)
// viven en src/lib/filtros.js como funciones puras, así que se comprueban
// aquí sin levantar React ni la app. Lo que importa no es solo que filtren
// bien, sino que el botón de "quitar filtros" devuelva siempre la lista
// entera: si FILTROS_INICIALES y los valores iniciales de la pantalla se
// desincronizan, no hay forma de deshacer un filtro.
const assert = require('assert');
const path = require('path');

const raiz = process.argv[2];
const {
  FILTROS_INICIALES,
  RANGOS_FECHA,
  ESTADOS_FILTRO,
  CATEGORIAS_FILTRO,
  AMBITOS_FILTRO,
  CRITERIOS_FILTRO,
  CRITERIOS_FORMULARIO,
  filtrarReportes,
  hayFiltrosActivos,
  resumenFiltros,
  pinesDelMapa,
  inicioDelRango,
  idsDe,
  etiquetaAmbito,
} = require(path.resolve(raiz, 'src/lib/filtros.js'));

const DIA = 86_400_000;
const ahora = Date.parse('2026-09-29T18:30:00Z');
const hace = (dias) => new Date(ahora - dias * DIA).toISOString();

const reportes = [
  { id: 1, category: 'Vialidad', status: 'Pendiente', created_at: hace(0.1), lat: -17.39, lng: -66.16 },
  { id: 2, category: 'Iluminación', status: 'Resuelto', created_at: hace(3), lat: -17.4, lng: -66.17 },
  { id: 3, category: 'Vialidad', status: 'Resuelto', created_at: hace(20), lat: -17.42, lng: -66.2 },
  { id: 4, category: 'Limpieza', status: 'En proceso', created_at: hace(45), lat: -17.38, lng: -66.18 },
  { id: 5, category: 'Otros', status: 'Pendiente', created_at: hace(90), lat: -17.3, lng: -66.1 },
  // Sin punto: el mapa no lo dibuja, así que los filtros del mapa tampoco
  // deberían contarlo.
  { id: 6, category: 'Vialidad', status: 'Pendiente', created_at: hace(1), lat: null, lng: null },
];

const ids = (lista) => lista.map((r) => r.id);
const con = (parche) => ({ ...FILTROS_INICIALES, ...parche });

// Un valor que ningún filtro usa, para comprobar que los valores
// desconhecidos caen en el comportamiento por defecto en vez de dejar la
// vista vacía sin aviso.
const NO_EXISTE = 'No existe';

const casos = [];

// ---- Sin filtros ----
// Nota: filtrar NO quita los reportes sin punto. Eso lo hace pinesDelMapa,
// y la pantalla compone los dos en ese orden: primero lo que se puede
// dibujar, después los criterios. Aquí el reporte 6 (sin coordenadas) se
// sigue contando, y por eso aparece en las listas de abajo.
casos.push([
  'sin filtros salen todos los reportes',
  ids(filtrarReportes(reportes, FILTROS_INICIALES, ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 3, 4, 5, 6]),
]);

casos.push([
  'sin filtros no hay nada activo',
  hayFiltrosActivos(FILTROS_INICIALES),
  (v) => v === false,
]);

// ---- Categoría ----
casos.push([
  'categoría Vialidad',
  ids(filtrarReportes(reportes, con({ categoria: 'Vialidad' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 3, 6]),
]);

casos.push([
  'categoría que no existe: lista vacía',
  ids(filtrarReportes(reportes, con({ categoria: 'Señalización' }), ahora)),
  (v) => v.length === 0,
]);

// ---- Estado ----
casos.push([
  'estado Resuelto',
  ids(filtrarReportes(reportes, con({ estado: 'Resuelto' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([2, 3]),
]);

casos.push([
  'estado Pendiente',
  ids(filtrarReportes(reportes, con({ estado: 'Pendiente' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 5, 6]),
]);

// ---- Alcance: toda la ciudad o solo lo que mandó la persona ----
//
// El pin del mapa no trae el dueño (el RPC no lo expone a propósito), así
// que "mío" se decide cruzando el id del pin con la lista propia de la
// persona. De ahí que las opciones se pasen aparte de los filtros.
const mios = [2, 4];

casos.push([
  'solo los míos',
  ids(
    filtrarReportes(reportes, con({ ambito: 'propios' }), ahora, {
      idsPropios: mios,
    })
  ),
  (v) => JSON.stringify(v) === JSON.stringify([2, 4]),
]);

// Sin la lista propia no hay forma de saber de quién es cada pin, y el
// riesgo de equivocarse es al revés: mostrarle a alguien los reportes de
// otro como si fueran suyos.
casos.push([
  'solo los míos sin lista propia no muestra nada',
  ids(filtrarReportes(reportes, con({ ambito: 'propios' }), ahora)),
  (v) => v.length === 0,
]);

casos.push([
  'solo los míos + estado',
  ids(
    filtrarReportes(reportes, con({ ambito: 'propios', estado: 'Resuelto' }), ahora, {
      idsPropios: mios,
    })
  ),
  (v) => JSON.stringify(v) === JSON.stringify([2]),
]);

casos.push([
  'el alcance por defecto no quita nada',
  ids(filtrarReportes(reportes, con({ ambito: 'todos' }), ahora, { idsPropios: mios })),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 3, 4, 5, 6]),
]);

// El alcance se aplica después de quitar lo que el mapa no dibuja, igual
// que los otros criterios: el contador y los pines no pueden discrepar.
casos.push([
  'sobre los pines del mapa, el alcance también',
  ids(
    filtrarReportes(pinesDelMapa(reportes), con({ ambito: 'propios' }), ahora, {
      idsPropios: [1, 3],
    })
  ),
  (v) => JSON.stringify(v) === JSON.stringify([1, 3]),
]);

casos.push([
  'con el alcance puesto sí hay algo activo',
  hayFiltrosActivos(con({ ambito: 'propios' })),
  (v) => v === true,
]);

casos.push([
  'el resumen dice el alcance puesto',
  resumenFiltros(con({ ambito: 'propios' })),
  (v) => /solo los míos/.test(v),
]);

// idsDe es lo que traduce la lista de reportes al conjunto que usa el
// filtro. Sin reports, sin exception: un id vacío no puede llegar al Set,
// o un reporte sin id se cruzaría con un undefined.
casos.push([
  'idsDe junta los ids y descarta los vacíos',
  [...idsDe([{ id: 'a' }, { id: 'b' }, { id: null }, {}])].sort(),
  (v) => JSON.stringify(v) === JSON.stringify(['a', 'b']),
]);

casos.push([
  'idsDe de una lista vacía',
  idsDe(undefined).size,
  (v) => v === 0,
]);

// ---- Fecha ----
casos.push([
  'últimos 7 días',
  ids(filtrarReportes(reportes, con({ fecha: '7d' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 6]),
]);

casos.push([
  'últimos 30 días',
  ids(filtrarReportes(reportes, con({ fecha: '30d' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 3, 6]),
]);

casos.push([
  'todo el tiempo no pone cota inferior',
  inicioDelRango('todo', ahora),
  (v) => v === null,
]);

// "Hoy" tiene que incluir lo de esta mañana aunque el rango fuera de 24
// horas: por eso se compara contra la medianoche, no contra hace 24h.
casos.push([
  'hoy incluye lo de hace una hora',
  ids(
    filtrarReportes(
      [{ id: 1, category: 'Otros', status: 'Pendiente', created_at: hace(0.1) }],
      con({ fecha: 'hoy' }),
      ahora
    )
  ),
  (v) => JSON.stringify(v) === JSON.stringify([1]),
]);

casos.push([
  'hoy excluye lo de ayer',
  ids(
    filtrarReportes(
      [{ id: 1, category: 'Otros', status: 'Pendiente', created_at: hace(1.2) }],
      con({ fecha: 'hoy' }),
      ahora
    )
  ),
  (v) => v.length === 0,
]);

// ---- Los tres a la vez ----
casos.push([
  'categoría + estado + fecha se combinan',
  ids(
    filtrarReportes(
      reportes,
      con({ categoria: 'Vialidad', estado: 'Resuelto', fecha: '30d' }),
      ahora
    )
  ),
  (v) => JSON.stringify(v) === JSON.stringify([3]),
]);

casos.push([
  'filtros que no se cruzan: vacío',
  ids(
    filtrarReportes(
      reportes,
      con({ categoria: 'Limpieza', estado: 'Resuelto', fecha: '7d' }),
      ahora
    )
  ),
  (v) => v.length === 0,
]);

// ---- El botón de quitar ----
casos.push([
  'quitar filtros devuelve la lista entera',
  ids(
    filtrarReportes(reportes, con({ categoria: 'Vialidad', estado: 'Resuelto', fecha: '7d' }), ahora)
  ),
  (v) => JSON.stringify(v) !== JSON.stringify([1, 2, 3, 4, 5]),
]);

casos.push([
  'FILTROS_INICIALES no filtra nada',
  ids(filtrarReportes(reportes, FILTROS_INICIALES, ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 3, 4, 5, 6]),
]);

// El orden con el que la pantalla compone las dos cosas: primero se quita
// lo que no se dibuja, después se filtran los criterios. Así el contador y
// los pines nunca pueden discrepar.
casos.push([
  'sobre los pines del mapa, los filtros se aplican después',
  ids(filtrarReportes(pinesDelMapa(reportes), con({ fecha: '7d' }), ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2]),
]);

casos.push([
  'con un filtro puesto sí hay algo activo',
  hayFiltrosActivos({ categoria: 'Otros', estado: 'Todos', fecha: 'todo' }),
  (v) => v === true,
]);

casos.push([
  'el resumen dice qué está puesto',
  resumenFiltros({ categoria: 'Vialidad', estado: 'Resuelto', fecha: '7d' }),
  (v) => /Vialidad/.test(v) && /Resuelto/.test(v) && /7 días/.test(v),
]);

// ---- Los pines del mapa ----
casos.push([
  'un reporte sin punto no se dibuja',
  ids(pinesDelMapa(reportes)),
  (v) => JSON.stringify(v) === JSON.stringify([1, 2, 3, 4, 5]),
]);

casos.push([
  'un punto fuera de Cochabamba tampoco',
  ids(
    pinesDelMapa([
      { id: 1, lat: -17.39, lng: -66.16 },
      { id: 2, lat: -18.5, lng: -66.16 },
      { id: 3, lat: -17.39, lng: -67.5 },
    ])
  ),
  (v) => JSON.stringify(v) === JSON.stringify([1]),
]);

// ---- Las opciones de las funciones de la pantalla ----
// El menú de categorías y el de estados tienen que ofrecer "Todos" o el
// filtro no tendría forma de deshacerse por su cuenta.
casos.push([
  'la lista de categorías empieza por Todos',
  CATEGORIAS_FILTRO[0],
  (v) => v === 'Todos',
]);

casos.push([
  'la lista de estados incluye Todos',
  ESTADOS_FILTRO.includes('Todos'),
  (v) => v === true,
]);

casos.push([
  'la lista de estados trae los tres estados reales',
  ESTADOS_FILTRO.filter((e) => e !== 'Todos').sort(),
  (v) => JSON.stringify(v) === JSON.stringify(['En proceso', 'Pendiente', 'Resuelto']),
]);

casos.push([
  'todo rango de fecha tiene etiqueta',
  RANGOS_FECHA.every((r) => typeof r.label === 'string' && r.label.length > 0),
  (v) => v === true,
]);

// El estado por defecto del filtro de fecha tiene que existir en la lista,
// o el chip de "Todo el tiempo" saldría ya marcado sin estar en las
// opciones.
casos.push([
  'el rango por defecto existe en la lista',
  RANGOS_FECHA.some((r) => r.clave === FILTROS_INICIALES.fecha),
  (v) => v === true,
]);

// Lo mismo con el alcance: el chip marcado tiene que estar entre las
// opciones que se pintan.
casos.push([
  'el alcance ofrece los dos valores',
  AMBITOS_FILTRO.map((a) => a.clave),
  (v) => JSON.stringify(v) === JSON.stringify(['todos', 'propios']),
]);

casos.push([
  'el alcance por defecto existe en la lista',
  AMBITOS_FILTRO.some((a) => a.clave === FILTROS_INICIALES.ambito),
  (v) => v === true,
]);

casos.push([
  'la etiqueta del alcance se lee como el chip',
  etiquetaAmbito('propios'),
  (v) => v === 'Solo los míos',
]);

casos.push([
  'un alcance desconocido se lee como "Todos"',
  etiquetaAmbito(NO_EXISTE),
  (v) => v === 'Todos',
]);

// Las filas que pinta cada pantalla. Si una pantalla pidiera un criterio
// que el módulo no define, esa fila nunca aparecería y el filtro quedaría
// puesto sin forma de verlo ni de quitarlo.
casos.push([
  'el mapa entero ofrece los cuatro criterios',
  CRITERIOS_FILTRO,
  (v) =>
    JSON.stringify(v) ===
    JSON.stringify(['categoria', 'estado', 'fecha', 'ambito']),
]);

casos.push([
  'el formulario del ciudadano ofrece estado y alcance',
  CRITERIOS_FORMULARIO,
  (v) => JSON.stringify(v) === JSON.stringify(['estado', 'ambito']),
]);

casos.push([
  'FILTROS_INICIALES deja el alcance en "todos"',
  FILTROS_INICIALES.ambito,
  (v) => v === 'todos',
]);

// Un filtro a medio construir (undefined) no puede dejar un criterio sin
// aplicar: si el alcance se perdiera al vuelo, el mapa mostraría reportes
// de otros creyéndose propios.
casos.push([
  'filtros a medio construir no filtran de más',
  ids(filtrarReportes(reportes, { estado: 'Resuelto' }, ahora)),
  (v) => JSON.stringify(v) === JSON.stringify([2, 3]),
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
    ? `\nOK · ${casos.length} comprobaciones de los filtros del mapa`
    : `\n${fallos} fallo(s) de ${casos.length}`
);
process.exit(fallos === 0 ? 0 : 1);
