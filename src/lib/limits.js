// Límites de la app. Se usan en los formularios (para avisar al usuario) y
// se replican como restricciones en la base de datos (supabase/schema.sql)
// para que ningún cliente se los pueda saltar.

// Máximo de caracteres por campo de texto.
export const LIMITS = {
  title: 120,
  place: 100,
  informe: 600,
  materiales: 300,
  mensajeFinal: 300,
  motivoReasignacion: 200,
  motivoReapertura: 300,
};

// Tiempo que el ciudadano puede corregir su reporte después de
// enviarlo. La misma regla está escrita en el trigger
// proteger_edicion_incidencia (supabase/schema.sql); este es el
// reflejo en la app para poder mostrar la cuenta regresiva sin
// pedir nada al servidor. El trigger es la barrera real: si alguien
// se salta la app, la base de datos lo bloquea igual.
export const EDIT_WINDOW_HOURS = 1;

// Motivos sugeridos al cambiar de técnico. El campo es libre, esto
// solo le ahorra escribirlo.
export const MOTIVOS_REASIGNACION = [
  'No tenía los materiales',
  'No se presentó al trabajo',
  'Zona fuera de su jurisdicción',
  'Necesita equipo especializado',
];

// Cómo terminó el trabajo, según el técnico.
export const CIERRES = [
  'Resuelto',
  'No se resolvió',
  'Hacía falta maquinaria',
  'No era de mi competencia',
  'El reporte estaba equivocado',
];

// Peso máximo de una imagen: 15 MB.
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

// Mensajes reutilizables.
export const IMAGE_TOO_LARGE_MESSAGE = `La imagen supera los ${MAX_IMAGE_MB} MB. Elige una más liviana.`;

export function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Recorta a "max" caracteres y deja un aviso con lo que falta.
export function limitText(text, max) {
  const value = String(text ?? '');
  if (value.length <= max) return null;
  return `Máximo ${max} caracteres (te faltan ${value.length - max}).`;
}

// ¿El ciudadano todavía puede corregir este reporte?
//
// Devuelve además el porqué, para que la interfaz pueda explicarlo en vez
// de dejar un botón muerto. Es una función pura: recibe el instante actual
// en `now` en lugar de leer el reloj, así el mismo resultado da siempre en
// un render, en un temporizador y en una prueba.
export function editWindow(report, now = Date.now()) {
  if (!report) {
    return { editable: false, reason: 'Reporte no disponible.', remainingMs: 0 };
  }

  // El municipio ya lo tomó: se congela para que el técnico pueda
  // trabajar sobre datos estables.
  if (report.status !== 'Pendiente') {
    return {
      editable: false,
      reason: `El municipio lo pasó a «${report.status}».`,
      remainingMs: 0,
    };
  }

  // Reabierto: vuelve a estar «Pendiente», pero los datos ya los leyó el
  // municipio y el técnico cuando se resolvió. Cambiar el título o la
  // ubicación de un caso ya atendido no tiene sentido, así que la ventana no
  // se reabre por mucho que siga dentro de la primera hora. La barrera real
  // también está en el trigger.
  if (report.reapertura_at) {
    return {
      editable: false,
      reason:
        'Lo reabriste para que lo revisen otra vez, así que ya no se ' +
        'pueden cambiar sus datos.',
      remainingMs: 0,
    };
  }

  // Ojo con esta comprobación: `new Date(null)` no es una fecha inválida,
  // es el epoch (1 de enero de 1970), mientras que `new Date(undefined)`
  // sí es inválido. Mirar solo `Number.isNaN` dejaría pasar el caso nulo,
  // que se leería como "este reporte es viejísimo" y bloquearía la
  // edición sin ningún motivo real.
  if (report.created_at == null || report.created_at === '') {
    return { editable: true, reason: '', remainingMs: 0, unknown: true };
  }

  const created = new Date(report.created_at).getTime();
  if (Number.isNaN(created)) {
    // Fecha presente pero ilegible: mismo criterio. Que decida el trigger.
    return { editable: true, reason: '', remainingMs: 0, unknown: true };
  }

  const remainingMs = created + EDIT_WINDOW_HOURS * 3_600_000 - now;

  if (remainingMs <= 0) {
    return {
      editable: false,
      reason: `La ventana de ${
        EDIT_WINDOW_HOURS === 1 ? '1 hora' : `${EDIT_WINDOW_HOURS} horas`
      } para corregirlo ya se cumplido.`,
      remainingMs: 0,
    };
  }

  return { editable: true, reason: '', remainingMs };
}

// Cuenta regresiva en formato corto: "58 min" o "12 s".
export function formatRemaining(ms) {
  if (ms <= 0) return '0 min';
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return `${Math.ceil(ms / 1000)} s`;
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const rest = totalMinutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
