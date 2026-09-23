// ============================================================
// Base de datos local de "Incidencias Urbanas CBBA".
// Todos los usuarios (ciudadanos, administrador y técnicos) y las
// incidencias ya vienen creados (seed). Los datos se guardan en
// localStorage (navegador) o en memoria (móvil / Expo Go).
// ============================================================

const DB_KEY = 'incidencias_urbanas_db_v1';
const SESSION_KEY = 'incidencias_urbanas_session_v1';

const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000).toISOString();

// ---- Usuarios precargados (solo copiar para entrar) ----
const seedUsers = [
  {
    id: 'u-ana',
    codigo: 'CBA-1001',
    email: 'ana.torres@demo.bo',
    password: 'ciudadano123',
    nombre: 'Ana Torres',
    role: 'Ciudadano',
  },
  {
    id: 'u-jorge',
    codigo: 'CBA-1002',
    email: 'jorge.quispe@demo.bo',
    password: 'ciudadano123',
    nombre: 'Jorge Quispe',
    role: 'Ciudadano',
  },
  {
    id: 'u-admin',
    codigo: 'ADM-0001',
    email: 'admin@demo.bo',
    password: 'admin123',
    nombre: 'María Fernández',
    role: 'Administrador',
  },
  {
    id: 'tec-1',
    codigo: 'TEC-0001',
    email: 'carlos.mamani@demo.bo',
    password: 'tecnico123',
    nombre: 'Carlos Mamani',
    role: 'Técnico',
  },
  {
    id: 'tec-2',
    codigo: 'TEC-0002',
    email: 'lucia.rojas@demo.bo',
    password: 'tecnico123',
    nombre: 'Lucía Rojas',
    role: 'Técnico',
  },
  {
    id: 'tec-3',
    codigo: 'TEC-0003',
    email: 'marco.quispe@demo.bo',
    password: 'tecnico123',
    nombre: 'Marco Quispe',
    role: 'Técnico',
  },
];

// ---- Incidencias precargadas (Cochabamba) ----
function seedReports() {
  return [
    {
      id: 'r-1',
      title: 'Bache en la avenida',
      category: 'Vialidad',
      place: 'Av. América',
      status: 'Pendiente',
      created_at: hoursAgo(2),
      user_id: 'u-ana',
      lat: -17.3833,
      lng: -66.1597,
      image_url: null,
      tecnico_id: null,
      tecnico_nombre: null,
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-2',
      title: 'Iluminación defectuosa',
      category: 'Iluminación',
      place: 'Calle Colombia',
      status: 'En proceso',
      created_at: hoursAgo(8),
      user_id: 'u-ana',
      lat: -17.3955,
      lng: -66.1652,
      image_url: null,
      tecnico_id: 'tec-1',
      tecnico_nombre: 'Carlos Mamani',
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-3',
      title: 'Basura acumulada',
      category: 'Limpieza',
      place: 'Parque Lincoln',
      status: 'Resuelto',
      created_at: hoursAgo(30),
      user_id: 'u-jorge',
      lat: -17.3891,
      lng: -66.1573,
      image_url: null,
      tecnico_id: 'tec-1',
      tecnico_nombre: 'Carlos Mamani',
      informe: 'Se retiraron 4 bolsas de residuos y se limpió el área.',
      materiales: 'Bolsas industriales, guantes, escoba.',
      informe_at: hoursAgo(20),
    },
    {
      id: 'r-4',
      title: 'Alumbrado público apagado',
      category: 'Iluminación',
      place: 'Calle Bolívar, zona centro',
      status: 'Pendiente',
      created_at: hoursAgo(5),
      user_id: 'u-jorge',
      lat: -17.3923,
      lng: -66.1601,
      image_url: null,
      tecnico_id: null,
      tecnico_nombre: null,
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-5',
      title: 'Escombro en la calzada',
      category: 'Vialidad',
      place: 'Av. Circunvalación km 3',
      status: 'En proceso',
      created_at: hoursAgo(26),
      user_id: 'u-ana',
      lat: -17.3789,
      lng: -66.1492,
      image_url: null,
      tecnico_id: 'tec-2',
      tecnico_nombre: 'Lucía Rojas',
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-6',
      title: 'Tapa de alcantarilla hundida',
      category: 'Agua y Alcantarillado',
      place: 'Calle Ayacucho',
      status: 'Pendiente',
      created_at: hoursAgo(50),
      user_id: 'u-jorge',
      lat: -17.3977,
      lng: -66.1559,
      image_url: null,
      tecnico_id: null,
      tecnico_nombre: null,
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-7',
      title: 'Árbol caído en la vereda',
      category: 'Áreas Verdes',
      place: 'Av. Ballivián, zona norte',
      status: 'En proceso',
      created_at: hoursAgo(54),
      user_id: 'u-ana',
      lat: -17.3766,
      lng: -66.1603,
      image_url: null,
      tecnico_id: 'tec-3',
      tecnico_nombre: 'Marco Quispe',
      informe: null,
      materiales: null,
      informe_at: null,
    },
    {
      id: 'r-8',
      title: 'Señal de tránsito deteriorada',
      category: 'Señalización',
      place: 'Plaza Colón',
      status: 'Resuelto',
      created_at: hoursAgo(72),
      user_id: 'u-jorge',
      lat: -17.3941,
      lng: -66.1582,
      image_url: null,
      tecnico_id: 'tec-2',
      tecnico_nombre: 'Lucía Rojas',
      informe: 'Se repintó la señal y se reemplazó el poste.',
      materiales: 'Pintura reflectiva, poste metálico.',
      informe_at: hoursAgo(60),
    },
  ];
}

function createSeedDb() {
  return {
    version: 1,
    users: seedUsers.map((u) => ({ ...u })),
    reports: seedReports(),
  };
}

function getStorage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    // localStorage puede fallar (modo privado); usamos memoria.
  }
  return null;
}

let memoryDb = null;
let memorySession = null;

export function loadDb() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.reports)) {
          return parsed;
        }
      }
    } catch {
      // datos corruptos: volvemos a crear el seed
    }
    const seeded = createSeedDb();
    try {
      storage.setItem(DB_KEY, JSON.stringify(seeded));
    } catch {
      // sin espacio: seguimos en memoria
    }
    return seeded;
  }
  if (!memoryDb) memoryDb = createSeedDb();
  return memoryDb;
}

export function saveDb(db) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(DB_KEY, JSON.stringify(db));
      return;
    } catch {
      // sin espacio: caemos a memoria
    }
  }
  memoryDb = db;
}

// ---- Sesión (para no volver a pedir login al recargar) ----
export function getSessionUserId() {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(SESSION_KEY);
    } catch {
      // ignorar
    }
  }
  return memorySession;
}

export function setSessionUserId(id) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(SESSION_KEY, id);
    } catch {
      // ignorar
    }
  }
  memorySession = id;
}

export function clearSessionUserId() {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(SESSION_KEY);
    } catch {
      // ignorar
    }
  }
  memorySession = null;
}

// ---- Consultas de usuarios ----
export function findUser(identifier, password) {
  const key = String(identifier ?? '').trim().toLowerCase();
  if (!key) return null;
  const db = loadDb();
  return (
    db.users.find(
      (u) =>
        (String(u.codigo).toLowerCase() === key ||
          String(u.email).toLowerCase() === key) &&
        u.password === password
    ) ?? null
  );
}

export function getUserById(id) {
  if (!id) return null;
  return loadDb().users.find((u) => u.id === id) ?? null;
}

export function toProfile(user) {
  if (!user) return null;
  const profile = { ...user };
  delete profile.password;
  return profile;
}

// Cuentas de ejemplo que se muestran en la pantalla de inicio de sesión.
export const exampleAccounts = ['u-admin', 'u-ana', 'tec-1'].map((id) => {
  const u = seedUsers.find((x) => x.id === id);
  return {
    role: u.role,
    nombre: u.nombre,
    codigo: u.codigo,
    email: u.email,
    password: u.password,
  };
});
