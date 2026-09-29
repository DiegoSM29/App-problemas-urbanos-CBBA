// Geolocalización en el navegador con mensajes útiles.
//
// La geolocalización del navegador SOLO funciona en contextos seguros:
// https:// o localhost. Si la app web se abre por IP de la LAN
// (http://192.168.x.x:8081) el navegador la bloquea y por eso aparece
// "no se pudo encontrar mi ubicación".

export function isSecureContext() {
  if (typeof window === 'undefined') return false;
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  const p = window.location?.protocol;
  const h = window.location?.hostname;
  return (
    p === 'https:' ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1'
  );
}

function codeToReason(err) {
  // 1 = permission denied, 2 = position unavailable, 3 = timeout
  if (err?.code === 1) return 'geo-denied';
  if (err?.code === 2) return 'geo-unavailable';
  return 'geo-timeout';
}

function attempt(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(codeToReason(err)),
      options
    );
  });
}

export async function getBrowserPosition() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('geo-unsupported');
  }
  if (!isSecureContext()) {
    throw new Error('geo-insecure');
  }
  try {
    // Intento 1: alta precisión.
    return await attempt({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  } catch (reason) {
    // Solo se reintenta si fue por timeout; denegado/no disponible no cambia.
    if (reason !== 'geo-timeout') throw new Error(reason);
  }
  // Intento 2: precisión normal con más tiempo (mejor en interiores).
  try {
    return await attempt({
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60000,
    });
  } catch (reason) {
    throw new Error(reason);
  }
}

// Mensajes amigables según el motivo del error.
export const GEO_MESSAGES = {
  'geo-unsupported':
    'Tu navegador no soporta geolocalización. Toca el mapa para marcar el punto.',
  'geo-insecure':
    'Tu navegador bloquea la geolocalización en esta dirección (necesita https:// o localhost). Toca el mapa para marcar el punto.',
  'geo-denied':
    'Bloqueaste el permiso de ubicación. Habilítalo en el navegador o toca el mapa para marcar el punto.',
  'geo-unavailable':
    'No se pudo obtener tu posición. Toca el mapa para marcar el punto.',
  'geo-timeout':
    'Tardó demasiado en encontrar tu posición. Toca el mapa para marcar el punto.',
};