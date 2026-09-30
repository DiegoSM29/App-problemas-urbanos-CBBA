// Límite geográfico de la aplicación.
//
// Esta app atiende el municipio de Cochabamba y su área metropolitana. Una
// incidencia marcada en otro departamento, en otra ciudad o en otro país no
// le sirve al municipio: se aceptaría como válida y nadie iría a trabajar
// ahí, así que el límite se escribe en dos sitios a propósito.
//
//   1. Este archivo → el mapa no deja salir de la ciudad, el formulario
//      avisa cuando el GPS cae fuera, y el botón de enviar se bloquea.
//   2. supabase/schema.sql → un CHECK en la tabla incidencias. Esta es la
//      barrera real: si alguien llama a la API saltándose la app, la base
//      de datos lo rechaza igual. La regla que manda es la del punto 2.
//
// Los números no deben repetirse a mano en el mapa. Aquí vive uno solo y el
// mapa web, el mapa nativo y el formulario lo leen de aquí.

export const COCHABAMBA_CENTER = {
  latitude: -17.3895,
  longitude: -66.1568,
};

// Rectángulo que envuelve el área metropolitana.
//
// Es amplio a propósito: incluye Quillacollo, Sacaba, Tiquipaya, Colcapirhua
// y Villa Gualberto Villarroel, que forman parte de la ciudad y se reportan
// igual todos los días. Aun así queda muy lejos de lo que está fuera: la
// capital más cercana es Punata, a 60 km, y Potosí está a 250 km. Ningún
// otro departamento ni ningún país cabe dentro.
export const COCHABAMBA_BOUNDS = {
  south: -17.5,
  west: -66.36,
  north: -17.2,
  east: -66.0,
};

// Formato [[sur, oeste], [norte, este]] que es el que espera Leaflet en
// maxBounds.
export const LEAFLET_MAX_BOUNDS = [
  [COCHABAMBA_BOUNDS.south, COCHABAMBA_BOUNDS.west],
  [COCHABAMBA_BOUNDS.north, COCHABAMBA_BOUNDS.east],
];

// Zoom con el que arranca el mapa (una calle a la vista, la ciudad completa
// alrededor). El mínimo deja ver el área metropolitana entera; el máximo es
// el que ya usaba el mapa, para no inventar un límite nuevo.
export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18;

// Ciudades de referencia para explicar el rechazo. Un "está fuera de
// Cochabamba" a secas deja al usuario adivinando; nombrar lo que tiene más
// cerca le dice hacia dónde corregir, que es lo que hace falta cuando el
// GPS se resuelve en otro lado.
const REFERENCIAS = [
  { nombre: 'Punata', latitude: -17.9667, longitude: -65.9667 },
  { nombre: 'Oruro', latitude: -17.967, longitude: -67.115 },
  { nombre: 'La Paz', latitude: -16.5, longitude: -68.15 },
  { nombre: 'Sucre', latitude: -19.033, longitude: -65.263 },
  { nombre: 'Potosí', latitude: -19.583, longitude: -65.752 },
  { nombre: 'Tarija', latitude: -21.535, longitude: -64.727 },
  { nombre: 'Tupiza', latitude: -20.533, longitude: -65.4 },
  { nombre: 'Villazón', latitude: -22.1, longitude: -65.6 },
  { nombre: 'Santa Cruz de la Sierra', latitude: -17.783, longitude: -63.182 },
  { nombre: 'Aiquile', latitude: -17.233, longitude: -65.25 },
  { nombre: 'Puerto Suárez', latitude: -18.967, longitude: -57.8 },
  { nombre: 'Cochabamba (centro)', latitude: -17.3895, longitude: -66.1568 },
];

export const OUTSIDE_CITY_MESSAGE =
  'Ese punto está fuera de Cochabamba. Marca la ubicación dentro de la ciudad.';

// ¿La coordenada cae dentro del área que atiende el municipio?
//
// Es una función pura a propósito: la usan el mapa, el formulario y las
// pruebas, y todas tienen que dar el mismo resultado con el mismo número.
export function isInsideCochabamba(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  const { south, west, north, east } = COCHABAMBA_BOUNDS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

// Distancia en kilómetros entre dos puntos, por la fórmula del haversine.
// Se usa solo para el texto del aviso, así que la precisión no es crítica.
function distanciaKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Explica por qué se rechaza una coordenada, o devuelve null si la
// coordenada sí es válida.
export function describeOutOfBounds(latitude, longitude) {
  if (isInsideCochabamba(latitude, longitude)) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'La ubicación obtenida no es válida. Toca el mapa para marcar el punto.';
  }

  let cerca = null;
  let menor = Infinity;
  for (const ref of REFERENCIAS) {
    const d = distanciaKm(lat, lng, ref.latitude, ref.longitude);
    if (d < menor) {
      menor = d;
      cerca = ref;
    }
  }

  if (!cerca) return OUTSIDE_CITY_MESSAGE;

  // "Lo más cerca es La Paz, a unos 0 km" no dice nada útil. Cuando el punto
  // está prácticamente encima de una ciudad, lo que quiere saber quien
  // reporta es que su GPS lolocated en otro lado.
  const extra =
    menor < 5
      ? ` Tu GPS te está ubicando en ${cerca.nombre}, no en Cochabamba.`
      : ` Lo más cerca es ${cerca.nombre}, a unos ${Math.round(menor)} km.`;
  return `${OUTSIDE_CITY_MESSAGE}${extra}`;
}
