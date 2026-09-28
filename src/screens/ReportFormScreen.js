import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, categories } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import CityMap from '../components/MapView';
import { LIMITS, limitText, MAX_IMAGE_MB } from '../lib/limits';
import {
  pickFromLibrary,
  captureFromCamera,
  previewUri,
} from '../services/images';
import {
  getBrowserPosition,
  GEO_MESSAGES,
} from '../services/geolocation';

export default function ReportFormScreen({ onSubmit }) {
  const { user } = useAuth();
  const { create } = useReports();

  const [category, setCategory] = useState('Vialidad');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [coords, setCoords] = useState(null);
  const [image, setImage] = useState(null);
  const [imageAsset, setImageAsset] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    setError('');
    setLocating(true);
    try {
      if (Platform.OS === 'web') {
        const pos = await getBrowserPosition();
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Se necesita permiso de ubicación para usar el GPS.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: 5 });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      const msg =
        (e?.message && GEO_MESSAGES[e.message]) ||
        e?.message ||
        'No se pudo obtener tu ubicación.';
      setError(msg);
    } finally {
      setLocating(false);
    }
  };

  const applyAsset = (asset) => {
    setImage(previewUri(asset));
    setImageAsset(asset);
  };

  // El servicio de imágenes ya valida el límite de 15 MB y avisa con un
  // mensaje claro si la foto pesa demasiado.
  const pickImage = async () => {
    setError('');
    try {
      const result = await pickFromLibrary();
      if (result.canceled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyAsset(result.asset);
    } catch {
      setError('No se pudo adjuntar la imagen.');
    }
  };

  const takePhoto = async () => {
    setError('');
    try {
      const result = await captureFromCamera();
      if (result.canceled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyAsset(result.asset);
    } catch {
      setError('No se pudo tomar la foto.');
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
      await create({
        title: title.trim(),
        category,
        place: place.trim(),
        lat: coords?.latitude ?? null,
        lng: coords?.longitude ?? null,
        user_id: user?.id,
        image_url: image,
        imageAsset,
      });
      setTitle('');
      setPlace('');
      setCoords(null);
      setImage(null);
      setImageAsset(null);
      onSubmit('Mis reportes');
    } catch (e) {
      setError(e.message || 'No se pudo enviar el reporte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>NUEVA INCIDENCIA</Text>
        <Text style={styles.title}>Reportar un problema urbano</Text>
        <Text style={styles.description}>
          Tu reporte ayuda a priorizar las necesidades de cada zona de
          Cochabamba.
        </Text>

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

        <Text style={styles.fieldLabel}>Ubicación en el mapa</Text>
        <CityMap
          reports={[]}
          onSelect={(c) => setCoords(c)}
          selectedCoords={coords}
          height={240}
        />
        <View style={styles.locationRow}>
          <Pressable
            style={[styles.locationButton, (busy || locating) && styles.disabled]}
            onPress={useMyLocation}
            disabled={busy || locating}
          >
            <Text style={styles.locationButtonText}>
              {locating ? 'Localizando…' : '◎ Usar mi ubicación'}
            </Text>
          </Pressable>
          {coords && (
            <Pressable
              style={styles.clearButton}
              onPress={() => setCoords(null)}
              disabled={busy || locating}
            >
              <Text style={styles.clearButtonText}>Limpiar</Text>
            </Pressable>
          )}
        </View>
        {coords ? (
          <Text style={styles.coords}>
            Ubicación marcada: {coords.latitude.toFixed(4)},{' '}
            {coords.longitude.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.coordsHint}>
            {Platform.OS === 'web'
              ? 'Haz clic en el mapa para marcar el punto exacto o usa tu ubicación.'
              : 'Presiona el mapa para marcar el punto exacto o usa tu ubicación actual.'}
          </Text>
        )}

        <Text style={styles.fieldLabel}>
          Evidencia fotográfica (opcional, máx. {MAX_IMAGE_MB} MB)
        </Text>
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
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
              style={[styles.imageButton, styles.photoButton, busy && styles.disabled]}
              onPress={takePhoto}
              disabled={busy}
            >
              <Text style={styles.imageButtonText}>📷 Tomar foto</Text>
            </Pressable>
            <Pressable
              style={[styles.imageButton, styles.photoButton, busy && styles.disabled]}
              onPress={pickImage}
              disabled={busy}
            >
              <Text style={styles.imageButtonText}>+ Galería</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.demoNote}>
          Tu reporte se guarda en la nube de Supabase y aparecerá en "Mis
          reportes".
        </Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.submitText}>
            {busy ? 'Enviando…' : 'Enviar reporte'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 34,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  category: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
  },
  coords: {
    fontSize: 11,
    color: colors.success,
    marginTop: 8,
    fontWeight: '700',
  },
  coordsHint: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  locationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#F7FBFD',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  locationButtonText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  demoNote: {
    color: colors.purple,
    fontSize: 11,
    marginTop: 4,
  },
  imageButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F7FBFD',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
  },
  imageButtonText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  imageWrap: {
    gap: 8,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: colors.hero,
  },
  removeImage: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  removeImageText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
  },
  counter: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: 3,
    marginBottom: -4,
  },
  submit: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});