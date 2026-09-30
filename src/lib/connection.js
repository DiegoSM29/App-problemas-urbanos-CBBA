// Detección de pérdida de conexión para toda la app.
//
// navigator.onLine solo indica si hay red local: puede seguir en true con el
// Wi-Fi conectado pero sin internet. Por eso, además de escuchar los eventos
// online/offline, cada petición a Supabase avisa si falló y la caída se
// confirma con un ping al endpoint de salud del proyecto.

const ONLINE = 'online';
const OFFLINE = 'offline';

const PING_TIMEOUT = 6000;
const RETRY_MS = 5000;

let status = currentBrowserStatus();
let probeUrl = null;
let probeTimer = null;
let probeBusy = false;
const listeners = new Set();

function currentBrowserStatus() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return OFFLINE;
  }
  return ONLINE;
}

// supabase.js registra la URL del proyecto para poder usar el ping.
export function configureProbe(url) {
  probeUrl = url;
}

export function getStatus() {
  return status;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStatus(next) {
  if (next === status) return;
  status = next;
  if (next === ONLINE && probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  listeners.forEach((listener) => listener(status));
}

// Una petición que sí responde demuestra que hay conexión.
export function reportSuccess() {
  if (currentBrowserStatus() === OFFLINE) return;
  setStatus(ONLINE);
}

// Una petición caída no siempre significa sin internet (puede ser un fallo
// puntual), así que se confirma con un ping antes de avisar al usuario.
export function reportFailure() {
  if (currentBrowserStatus() === OFFLINE) {
    setStatus(OFFLINE);
    return;
  }
  scheduleProbe(0);
}

function scheduleProbe(delay) {
  if (probeTimer) return; // ya hay una comprobación pendiente
  probeTimer = setTimeout(() => {
    probeTimer = null;
    runProbe();
  }, delay);
}

async function runProbe() {
  if (probeBusy || !probeUrl || typeof fetch !== 'function') return;
  probeBusy = true;
  try {
    const ok = await ping();
    setStatus(ok ? ONLINE : OFFLINE);
    // Mientras siga caída se reintenta solo, para avisar en cuanto vuelva.
    if (!ok) scheduleProbe(RETRY_MS);
  } finally {
    probeBusy = false;
  }
}

async function ping() {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), PING_TIMEOUT)
    : null;
  try {
    const res = await fetch(`${probeUrl}/auth/v1/health?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    });
    return !!res && res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Cancela la espera pendiente y comprueba el estado ahora mismo.
function probeNow() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  runProbe();
}

// Botón "Reintentar" del aviso: fuerza una comprobación inmediata.
export function recheck() {
  if (status === ONLINE) return;
  probeNow();
}

// Traduce el error técnico de una petición a un mensaje entendible.
export function describeError(error) {
  const raw = String(error?.message ?? error ?? '').trim();
  if (!raw) return 'No se pudo completar la operación.';
  const lostConnection =
    /failed to fetch|network ?error|network request failed|load failed|err_[a-z_]+|econnrefused|etimedout|timeout|timed out|aborted/i.test(
      raw
    );
  if (lostConnection) {
    return 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  }
  return raw;
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('offline', () => setStatus(OFFLINE));
  // Al volver la señal del navegador se confirma con el ping de inmediato, sin
  // esperar al reintento periódico.
  window.addEventListener('online', () => probeNow());
}
