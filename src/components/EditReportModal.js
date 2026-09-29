import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, categories } from '../theme/colors';
import {
  LIMITS,
  limitText,
  MAX_IMAGE_MB,
  editWindow,
  formatRemaining,
} from '../lib/limits';
import {
  pickFromLibrary,
  captureFromCamera,
  previewUri,
} from '../services/images';

// Permite corregir un reporte propio durante la primera hora, siempre que
// el municipio no lo haya tomado todavía. Al cumplirse la hora, el formulario
// se bloquea aquí mismo, sin esperar a que el usuario intente guardar.
export default function EditReportModal({ report, visible, onClose, onSave }) {
  const [category, setCategory] = useState(report?.category);
  const [title, setTitle] = useState(report?.title);
  const [place, setPlace] = useState(report?.place);
  const [image, setImage] = useState(report?.image_url ?? null);
  const [imageAsset, setImageAsset] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Reloj propio del modal. La ventana viene calculada al cargar la lista,
  // así que sin esto el contador se quedaría congelado en el valor que
  // tenía hace diez minutos.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [visible, report?.id]);

  if (!visible || !report) return null;

  // La ventana se recalcula aquí contra el reloj del modal para que se
  // cierre sola al cumplirse la hora. La regla en sí vive en
  // `lib/limits.js` y, sobre todo, en el trigger del servidor: esto solo
  // evita que alguien escriba diez minutos para que el guardado falle.
  const ventana = editWindow({
    status: report.status,
    created_at: report.created_at,
    now,
  });
  const editable = ventana.editable;

  const reset = () => {
    setCategory(report.category);
    setTitle(report.title);
    setPlace(report.place);
    setImage(report.image_url ?? null);
    setImageAsset(null);
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const choose = async (picker) => {
    setError('');
    try {
      const result = await picker();
      if (result.canceled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setImageAsset(result.asset);
      setImage(previewUri(result.asset));
    } catch {
      setError('No se pudo adjuntar la imagen.');
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('Describe brevemente el problema.');
      return;
    }
    if (!place.trim()) {
      setError('Indica la zona, calle o referencia.');
      return;
    }
    const tooLong =
      limitText(title, LIMITS.title) || limitText(place, LIMITS.place);
    if (tooLong) {
      setError(tooLong);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(report.id, {
        title: title.trim(),
        category,
        place: place.trim(),
        lat: report.lat,
        lng: report.lng,
        image_url: image,
        imageAsset,
        status: report.status,
        created_at: report.created_at,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el reporte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Editar reporte</Text>
            <Pressable onPress={close} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {!editable ? (
            <View style={styles.locked}>
              <Text style={styles.lockedTitle}>Reporte no editable</Text>
              <Text style={styles.lockedText}>
                {ventana.reason ||
                  'Este reporte ya no se puede editar. Cuando el trabajo empieza no se pueden cambiar los datos del reporte.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.windowBar}>
                <Text style={styles.windowText}>
                  {ventana.unknown ? (
                    <>Puedes corregirlo mientras siga pendiente.</>
                  ) : (
                    <>
                      ⏱ Te queda {formatRemaining(ventana.remainingMs)} para
                      corregirlo
                    </>
                  )}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.categories}>
                {categories
                  .filter((c) => c !== 'Todos')
                  .map((c) => {
                    const active = category === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        style={[styles.category, active && styles.categoryActive]}
                      >
                        <Text
                          style={[
                            styles.categoryText,
                            active && styles.categoryTextActive,
                          ]}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>

              <Text style={styles.fieldLabel}>Descripción del problema</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Bache grande en la avenida..."
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={LIMITS.title}
                value={title}
                onChangeText={setTitle}
                editable={!busy}
              />
              <Text style={styles.counter}>
                {title.length}/{LIMITS.title}
              </Text>

              <Text style={styles.fieldLabel}>Ubicación</Text>
              <TextInput
                style={styles.input}
                placeholder="Zona, calle o referencia"
                placeholderTextColor={colors.placeholder}
                maxLength={LIMITS.place}
                value={place}
                onChangeText={setPlace}
                editable={!busy}
              />
              <Text style={styles.counter}>
                {place.length}/{LIMITS.place}
              </Text>

              <Text style={styles.fieldLabel}>
                Evidencia fotográfica (opcional, máx. {MAX_IMAGE_MB} MB)
              </Text>
              {image ? (
                <View style={styles.imageWrap}>
                  <Image
                    source={{ uri: image }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  <Pressable
                    style={styles.removeImage}
                    onPress={() => {
                      setImage(null);
                      setImageAsset(null);
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.removeImageText}>Quitar imagen</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoRow}>
                  <Pressable
                    style={[styles.photoButton, busy && styles.disabled]}
                    onPress={() => choose(captureFromCamera)}
                    disabled={busy}
                  >
                    <Text style={styles.photoButtonText}>📷 Tomar foto</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.photoButton, busy && styles.disabled]}
                    onPress={() => choose(pickFromLibrary)}
                    disabled={busy}
                  >
                    <Text style={styles.photoButtonText}>+ Galería</Text>
                  </Pressable>
                </View>
              )}

              {!!error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[styles.save, busy && styles.disabled]}
                onPress={submit}
                disabled={busy}
              >
                <Text style={styles.saveText}>
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 54, 83, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  close: {
    paddingHorizontal: 6,
  },
  closeText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textFaint,
  },
  windowBar: {
    backgroundColor: '#FEF6E7',
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  windowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B5761A',
  },
  locked: {
    backgroundColor: '#F3F7F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  lockedText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: 3,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  category: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#F7FAFB',
  },
  photoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  imageWrap: {
    marginTop: 4,
  },
  image: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    backgroundColor: colors.hero,
  },
  removeImage: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  removeImageText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
  },
  save: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
