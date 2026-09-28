// Selección de imágenes (cámara / galería) con el límite de peso.
// Se usa al reportar, al editar el reporte y al subir la foto del informe
// técnico, para no repetir el mismo código en tres pantallas.

import * as ImagePicker from 'expo-image-picker';
import { MAX_IMAGE_BYTES, IMAGE_TOO_LARGE_MESSAGE, formatBytes } from '../lib/limits';

const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: 0.4,
  base64: true,
};

// Peso real del archivo. expo-image-picker lo da en fileSize; si no viene,
// se estima a partir del base64 que trae el asset.
export function imageBytes(asset) {
  if (!asset) return 0;
  if (typeof asset.fileSize === 'number' && asset.fileSize > 0) {
    return asset.fileSize;
  }
  if (asset.base64) {
    return Math.ceil((asset.base64.length * 3) / 4);
  }
  return 0;
}

export function isTooLarge(asset) {
  const bytes = imageBytes(asset);
  return bytes > 0 && bytes > MAX_IMAGE_BYTES;
}

// URI para previsualizar; en web/nativo el base64 se muestra como data URI.
export function previewUri(asset) {
  if (!asset) return null;
  if (asset.base64) {
    return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }
  return asset.uri ?? null;
}

// Valida el asset y devuelve el error o null.
export function validateImage(asset) {
  if (!asset) return 'No se pudo leer la imagen.';
  if (isTooLarge(asset)) {
    return `${IMAGE_TOO_LARGE_MESSAGE} (${formatBytes(imageBytes(asset))})`;
  }
  return null;
}

async function pick(launcher, permissionRequest, deniedMessage, failureMessage) {
  const permission = await permissionRequest();
  if (!permission.granted) {
    return { ok: false, error: deniedMessage };
  }
  const result = await launcher(PICKER_OPTIONS);
  if (result.canceled) return { ok: false, canceled: true };
  const asset = result.assets?.[0];
  const error = validateImage(asset);
  if (error) return { ok: false, error };
  return { ok: true, asset };
}

export function pickFromLibrary() {
  return pick(
    ImagePicker.launchImageLibraryAsync,
    ImagePicker.requestMediaLibraryPermissionsAsync,
    'Se necesita permiso para acceder a tus imágenes.',
    'No se pudo adjuntar la imagen.'
  );
}

export function captureFromCamera() {
  return pick(
    ImagePicker.launchCameraAsync,
    ImagePicker.requestCameraPermissionsAsync,
    'Se necesita permiso para usar la cámara.',
    'No se pudo tomar la foto.'
  );
}
