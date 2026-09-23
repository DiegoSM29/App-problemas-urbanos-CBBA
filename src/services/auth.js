// Autenticación contra la base de datos local (ver services/db.js).
// El rol NO se elige al entrar: sale de la cuenta (perfil).

import {
  findUser,
  getUserById,
  getSessionUserId,
  setSessionUserId,
  clearSessionUserId,
  toProfile,
} from './db';

export async function getSessionUser() {
  const id = getSessionUserId();
  if (!id) return null;
  const user = getUserById(id);
  if (!user) {
    clearSessionUserId();
    return null;
  }
  return toProfile(user);
}

export async function fetchProfile(userId) {
  if (!userId) return null;
  return toProfile(getUserById(userId));
}

export async function signIn(identifier, password) {
  const user = findUser(identifier, password);
  if (!user) {
    throw new Error(
      'El código o correo y la contraseña no coinciden con ninguna cuenta creada.'
    );
  }
  setSessionUserId(user.id);
  return toProfile(user);
}

export async function signOut() {
  clearSessionUserId();
}
