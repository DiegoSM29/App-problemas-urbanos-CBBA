// Filtros del mapa de incidencias.
//
// Los criterios que pidió el municipio —categoría, fecha en que se publicó y
// estado— se combinan entre sí (el que se elige en cada uno tiene que
// cumplirse todos a la vez). El ciudadano tiene además un cuarto, de alcance:
// toda la ciudad o solo los reportes que mandó él.
//
// Son filtros de cliente a propósito: la pantalla ya tiene la lista en
// memoria, así que filtrar no cuesta ninguna petición extra y el mapa
// responde al instante.
//
// Es un módulo puro, sin React, igual que lib/limits.js: las reglas se
// comprueban con Node (pruebas/test-filtros.js) sin levantar la app.

// Estos dos importan con extensión a propósito, y es el único archivo de
// src/lib/ que lo hace. La razón es la batería de pruebas: este módulo se
// carga con `require` desde Node, que lo trata como ESM y ahí un import sin
// ".js" no se resuelve. Metro (el empaquetador de Expo) lo acepta igual, así
// que los dos lados funcionan.
import { categories, statuses } from '../theme/colors.js';
import { isInsideCochabamba } from './region.js';

const DIA_MS = 86_400_000;

// Rangos de "fecha en que se publicó".
//
// No hay un selector de fechas en el proyecto (ni en web ni en el móvil) y
// meter una dependencia para esto no compensa: con estos cinco rangos se
// cubre el uso real del municipal, que pregunta por lo reciente.
export const RANGOS_FECHA = [
  { clave: 'todo', label: 'Todo el tiempo' },
  { clave: 'hoy', label: 'Hoy' },
  { clave: '7d', label: 'Últimos 7 días' },
  { clave: '30d', label: 'Últimos 30 días' },
  { clave: 'mes', label: 'Este mes' },
];

// El estado del filtro incluye "Todos", que no es un estado real sino la
// opción de no filtrar por estado.
export const ESTADOS_FILTRO = ['Todos', ...statuses];

// El alcance: toda la ciudad o solo lo que reportó la persona.
//
// Es el único criterio que no es un atributo del reporte, y por eso vive
// aparte: solo lo ofrece el ciudadano (el administrador no reporta
// incidencias y el técnico ya ve únicamente las que el municipio le
// asignó, así que para los dos no añadiría nada).
export const AMBITOS_FILTRO = [
  { clave: 'todos', label: 'Todos' },
  { clave: 'propios', label: 'Solo los míos' },
];

// Qué filas se pintan y en qué orden. `CRITERIOS_FILTRO` es el mapa entero
// (ciudadano y administrador); `CRITERIOS_FORMULARIO` es la versión corta que
// se usa en el mapa de "reportar" y "editar", donde la pregunta es si el
// problema ya está reportado: ahí manda el estado y quién lo mandó, no la
// categoría ni la fecha.
export const CRITERIOS_FILTRO = ['categoria', 'estado', 'fecha', 'ambito'];
export const CRITERIOS_FORMULARIO = ['estado', 'ambito'];

export const FILTROS_INICIALES = {
  categoria: 'Todos',
  estado: 'Todos',
  fecha: 'todo',
  ambito: 'todos',
};

// Une los filtros con los valores por defecto, para que un estado a medio
// construir (o undefined) no deje un criterio sin filtro aplicado.
function completos(filtros) {
  return { ...FILTROS_INICIALES, ...(filtros || {}) };
}

// Instante a partir del cual cuenta un reporte, o null si el rango es "todo
// el tiempo" (no hay cota inferior).
export function inicioDelRango(clave, now = Date.now()) {
  switch (clave) {
    case 'hoy': {
      // Medianoche local de hoy, no hace 24 horas: "Hoy" tiene que incluir
      // el reporte de las 8 de la mañana aunque ahora sean las 23:00.
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case '7d':
      return now - 7 * DIA_MS;
    case '30d':
      return now - 30 * DIA_MS;
    case 'mes': {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case 'todo':
    default:
      return null;
  }
}

export function etiquetaFecha(clave) {
  return RANGOS_FECHA.find((r) => r.clave === clave)?.label ?? 'Todo el tiempo';
}

export function etiquetaAmbito(clave) {
  return AMBITOS_FILTRO.find((a) => a.clave === clave)?.label ?? 'Todos';
}

// Los ids de una lista de reportes, que es como se sabe cuáles son de la
// persona (ver `filtrarReportes`). Los ids vacíos se descartan: sin id no
// hay pin que cruzar, y un undefined en el conjunto haría que un reporte sin
// id contara como propio.
export function idsDe(reports) {
  return new Set((reports ?? []).map((r) => r?.id).filter((id) => id != null));
}

// Acepta el conjunto de ids como venga. Sin lista devuelve un conjunto
// vacío, que hace que "solo los míos" no muestre nada: es mejor que mostrar
// los reportes de otra persona como si fueran de esta.
function aConjunto(ids) {
  return ids instanceof Set ? ids : new Set(ids ?? []);
}

// Aplica todos los criterios a la vez.
//
// `opciones.idsPropios` son los ids de los reportes de la persona (un Set o
// un array). No se deduce del propio pin porque el RPC del mapa no devuelve
// el dueño a propósito (es información de otra persona: ver
// pruebas/test-consistencia.js, que falla si `user_id` aparece entre las ocho
// columnas). Como el mapa del ciudadano y su lista de "Mis reportes" salen
// de la misma base, los ids se cruzan y cada pin sabe de quién es.
export function filtrarReportes(
  reports,
  filtros = FILTROS_INICIALES,
  now = Date.now(),
  opciones = {}
) {
  const f = completos(filtros);
  const desde = inicioDelRango(f.fecha, now);
  const mios = aConjunto(opciones.idsPropios);

  return (reports ?? []).filter((r) => {
    if (f.categoria !== 'Todos' && r.category !== f.categoria) return false;
    if (f.estado !== 'Todos' && r.status !== f.estado) return false;
    if (f.ambito === 'propios' && !mios.has(r?.id)) return false;

    if (desde !== null) {
      // Un reporte sin fecha no cae dentro de ningún rango: sin `created_at`
      // no hay manera de saber cuándo se publicó, así que no se cuenta
      // como reciente en vez de inventarlo.
      const publicado = r.created_at ? new Date(r.created_at).getTime() : NaN;
      if (!Number.isFinite(publicado) || publicado < desde) return false;
    }

    return true;
  });
}

export function hayFiltrosActivos(filtros = FILTROS_INICIALES) {
  const f = completos(filtros);
  return (
    f.categoria !== FILTROS_INICIALES.categoria ||
    f.estado !== FILTROS_INICIALES.estado ||
    f.fecha !== FILTROS_INICIALES.fecha ||
    f.ambito !== FILTROS_INICIALES.ambito
  );
}

// Qué hay puesto ahora, en una línea. Se muestra junto al botón de quitar
// filtros para que quien mira sepa qué está viendo sin tener que abrir los
// grupos uno por uno.
export function resumenFiltros(filtros = FILTROS_INICIALES) {
  const f = completos(filtros);
  const partes = [];

  if (f.categoria !== 'Todos') partes.push(f.categoria);
  if (f.estado !== 'Todos') partes.push(f.estado);
  if (f.fecha !== 'todo') partes.push(etiquetaFecha(f.fecha).toLowerCase());
  if (f.ambito === 'propios') partes.push(etiquetaAmbito(f.ambito).toLowerCase());

  return partes.join(' · ');
}

// Los reportes que el mapa puede dibujar de verdad: con coordenadas y
// dentro del área que atiende el municipio.
//
// El mapa (web y nativo) aplica este mismo criterio al pintar los pines. Se
// centraliza aquí para que el contador de la pantalla y los pines que se
// ven no puedan discrepar, que era lo que pasaba antes: se contaban
// reportes sin ubicación que el mapa nunca dibujaba.
export function pinesDelMapa(reports) {
  return (reports ?? []).filter(
    (r) =>
      r.lat != null &&
      r.lng != null &&
      isInsideCochabamba(r.lat, r.lng)
  );
}

// Las categorías que ofrece el filtro: las del menú de la app, que ya
// empiezan por "Todos".
export const CATEGORIAS_FILTRO = categories;
