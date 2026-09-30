// Reportes duplicados: la misma categoría en el mismo punto.
//
// El municipio pidió que un mismo problema no se reporte dos veces: si ya hay
// un reporte de Iluminación en esa calle, otro reporte de Iluminación a menos
// de 30 metros del primero es la misma farola, el mismo bache o el mismo
// charco.
//
// La regla vive aquí, en un módulo puro como lib/filtros.js y lib/limits.js,
// para poder comprobarla con Node (pruebas/test-duplicados.js) sin levantar
// la app. La barrera de verdad, sin embargo, está en la base de datos (el
// trigger `bloquear_reporte_duplicado` de supabase/schema.sql): quien llame a
// la API sin pasar por la app tampoco puede meter un duplicado. Las dos copias
// tienen que decir exactamente lo mismo, y pruebas/test-consistencia.js lo
// comprueba (el radio y hasta la frase del aviso).

// El radio en metros. Es el mismo número que el trigger: si se mueve uno hay
// que mover el otro, y la prueba de consistencia avisa si se olvidan.
export const RADIO_DUPLICADO_M = 30;

// Radio de la Tierra en metros. El mismo del trigger, para que la distancia
// que mide la app sea la misma que mide la base: a 29,99 m de distancia los
// dos lados tienen que coincidir, o el reporte pasaría en la app y reventaría
// en el servidor (o al revés, que es peor: dejaría pasar el duplicado).
const RADIO_TIERRA_M = 6371000;

// La primera frase del aviso, escrita igual aquí y en el trigger. Es lo que
// el cliente usa para reconocer el error del servidor y mostrarlo tal cual
// (ya está escrito para quien lee la app, no para quien lee un log).
export const AVISO_DUPLICADO = 'Ya hay un reporte de esta categoría a menos de';

// El estado que el municipio ya cerró. Un reporte así no estorba: el problema
// puede haber vuelto (de eso está la reapertura), y si contara, una vez
// resuelta una esquina nadie podría volver a reportar nada en ella.
const RESUELTO = 'Resuelto';

// Normaliza un punto a grados.
//
// Acepta las dos formas que hay en la app: {lat, lng}, que es lo que devuelve
// la base, y {latitude, longitude}, que es lo que devuelve el GPS. Sin este
// cuidado, un `undefined` en el campo equivocado daría una distancia de NaN o
// de 0, y 0 quiere decir "duplicado" en todas partes.
//
// El texto en blanco se cuenta como ausente a propósito: Number('') es 0, y 0
// son unas coordenadas perfectamente válidas... en el golfo de Guinea. Un
// reporte con las coordenadas en blanco se trataría como si estuviera al otro
// lado del planeta.
function coordenada(v) {
  if (v == null) return NaN;
  if (typeof v === 'string' && v.trim() === '') return NaN;
  return Number(v);
}

function punto(x) {
  const lat = coordenada(x?.lat ?? x?.latitude);
  const lng = coordenada(x?.lng ?? x?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Distancia entre dos puntos, en metros (fórmula del haversine).
//
// Se elige haversine y no una aproximación en grados porque el trigger tiene
// que hacer exactamente la misma cuenta, y entre las dos versiones no puede
// quedar ni un milímetro de diferencia en el borde de los 30 metros.
export function distanciaMetros(a, b) {
  const p1 = punto(a);
  const p2 = punto(b);
  if (!p1 || !p2) return null;

  const rad = Math.PI / 180;
  const dLat = (p2.lat - p1.lat) * rad;
  const dLng = (p2.lng - p1.lng) * rad;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos(p1.lat * rad) * Math.cos(p2.lat * rad) * s2 * s2;

  // El min(1, …) protege a Math.asin del redondeo: si h se pasa de 1 por error
  // de coma flotante, asin devolvería NaN y el duplicado pasaría sin que nadie
  // se entere.
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// El reporte ya existente que choca con el que se quiere registrar, o null.
//
// Se devuelve el más cercano (y la distancia, ya redondeada a metros enteros
// para el aviso) porque es el que el vecino reconocerá: "el de la farola de la
// esquina" y no "el otro, a 29 metros".
//
// `excludeId` sirve para la edición: el reporte que se está editando no puede
// ser su propio duplicado.
export function duplicadoDe(candidato, existentes, opciones = {}) {
  const radio = opciones.radio ?? RADIO_DUPLICADO_M;
  const origen = punto(candidato);
  const categoria = candidato?.category;

  // Sin categoría no hay con qué comparar, y sin punto no hay distancia que
  // medir. Un reporte sin ubicación no se frena: se frena cuando se manda
  // desde el mapa, que es donde la regla tiene sentido.
  if (!origen || !categoria) return null;

  let mejor = null;
  let mejorMetros = Infinity;

  for (const r of existentes ?? []) {
    if (!r) continue;
    if (opciones.excludeId != null && r.id === opciones.excludeId) continue;
    if (r.category !== categoria) continue;
    if (r.status === RESUELTO) continue;

    const d = distanciaMetros(origen, r);
    if (d == null || d > radio) continue;

    if (d < mejorMetros) {
      mejor = r;
      mejorMetros = d;
    }
  }

  // El radio vuelve en el resultado: el aviso tiene que decir el que se
  // comprobó, no el de serie, por si algún día se llama con otro.
  return mejor
    ? { reporte: mejor, metros: Math.round(mejorMetros), radio }
    : null;
}

// El aviso que ve quien reportaba, con lo que ya hay registrado.
//
// La primera frase es la misma que escribe el trigger (con el radio que se
// comprobó), y el resto son los datos del reporte que choca: sin ellos el
// ciudadano sabría que no puede seguir, pero no qué encontró ni dónde, y no
// sabría si lo que iba a reportar es justo lo mismo.
//
// Los datos del pin pueden faltar (un reporte antiguo sin título, o un RPC que
// no los devuelva), así que solo se añaden los que hay: un aviso con
// «undefined» dentro pierde el sentido entero.
export function mensajeDuplicado(duplicado) {
  const r = duplicado?.reporte ?? {};
  const radio = duplicado?.radio ?? RADIO_DUPLICADO_M;
  const metros = duplicado?.metros;

  const encontrados = [
    r.title ? `«${r.title}»` : null,
    r.place || null,
  ].filter(Boolean);
  const detalles = [
    r.status || null,
    metros == null ? null : `a ${metros} m`,
  ].filter(Boolean);

  const corto = `${AVISO_DUPLICADO} ${radio} metros de este punto`;

  // Sin pin no hay nada que describir: el aviso se queda en la frase corta,
  // con lo que sí se sepa entre paréntesis.
  if (!encontrados.length) {
    return detalles.length ? `${corto} (${detalles.join(', ')}).` : `${corto}.`;
  }

  return (
    `${corto}. Ya está registrado como ${encontrados.join(' en ')}` +
    (detalles.length ? ` (${detalles.join(', ')}).` : '.')
  );
}
