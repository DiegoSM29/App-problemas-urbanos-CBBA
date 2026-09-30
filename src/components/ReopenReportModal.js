// El ciudadano devuelve al municipio un reporte que le resolvieron pero que
// en la calle sigue igual.
//
// Solo se abre sobre reportes «Resuelto» y pide un motivo: es lo que le
// falta al municipio para saber qué revisar. El motivo se guarda con la
// fecha, y el técnico que lo atendió se conserva, así que el caso vuelve a
// la cola sin perder su historial.
//
// El trigger proteger_edicion_incidencia es la barrera real de este
// formulario: aunque alguien se salte la app, el servidor no deja reabrir
// un reporte que no sea suyo, ni uno que no esté resuelto, ni sin motivo.

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { LIMITS, limitText } from '../lib/limits';
import { MIN_MOTIVO_REAPERTURA } from '../services/reports';

const MOTIVOS = [
  'El problema sigue en el mismo lugar',
  'Lo repararon a medias',
  'Volvió a aparecer a los pocos días',
];

export default function ReopenReportModal({ report, visible, onClose, onSave }) {
  // El modal vive montado con `report` en null (ReportsScreen lo renderiza
  // siempre), así que el estado nace en '' y no en undefined.
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Al abrirlo se arranca en blanco, igual que al guardar un informe: el
  // motivo de la vez anterior no tiene nada que ver con este caso.
  const [abiertoId, setAbiertoId] = useState(null);
  if (visible && report && report.id !== abiertoId) {
    setAbiertoId(report.id);
    setMotivo('');
    setError('');
    setBusy(false);
  }

  // La lista de sugerencias se muestra solo si el ciudadano no escribió
  // nada: una vez que escribió, taparle con los chips sería un estorbo.
  useEffect(() => {
    if (!visible) setAbiertoId(null);
  }, [visible]);

  if (!visible || !report) return null;

  const close = () => {
    setMotivo('');
    setError('');
    setBusy(false);
    setAbiertoId(null);
    onClose();
  };

  const anadirMotivo = (m) => {
    setMotivo((prev) => (prev ? `${prev} ${m}` : m));
    setError('');
  };

  const submit = async () => {
    const texto = motivo.trim();
    if (texto.length < MIN_MOTIVO_REAPERTURA) {
      setError(
        `Escribe al menos ${MIN_MOTIVO_REAPERTURA} caracteres: el municipio necesita saber qué sigue mal.`
      );
      return;
    }
    const tooLong = limitText(texto, LIMITS.motivoReapertura);
    if (tooLong) {
      setError(tooLong);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await onSave(report.id, texto, report.status);
      close();
    } catch (e) {
      setError(e?.message ?? 'No se pudo reabrir el reporte.');
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
            <Text style={styles.title}>Reabrir reporte</Text>
            <Pressable onPress={close} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.resumen}>
            <Text style={styles.resumenTitle} numberOfLines={2}>
              {report.title}
            </Text>
            <Text style={styles.resumenMeta} numberOfLines={1}>
              {report.place} · {report.category}
            </Text>
          </View>

          <Text style={styles.aviso}>
            Tu reporte volvió a marcarse como resuelto pero el problema sigue.
            Al reabrirlo vuelve a la cola del municipio.
          </Text>

          <Text style={styles.label}>
            ¿Qué sigue mal? (máx. {LIMITS.motivoReapertura} caracteres)
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Ej. El bache se volvió a abrir con la lluvia y sigue en el mismo punto..."
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={LIMITS.motivoReapertura}
            value={motivo}
            onChangeText={setMotivo}
            editable={!busy}
          />
          <Text style={styles.contador}>
            {motivo.length}/{LIMITS.motivoReapertura}
          </Text>

          {!motivo.trim() && (
            <>
              <Text style={styles.sugerenciasLabel}>Puedes empezar con:</Text>
              <View style={styles.sugerencias}>
                {MOTIVOS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => anadirMotivo(m)}
                    style={styles.sugerencia}
                    disabled={busy}
                  >
                    <Text style={styles.sugerenciaText}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.botones}>
            <Pressable
              style={[styles.cancelar, busy && styles.disabled]}
              onPress={close}
              disabled={busy}
            >
              <Text style={styles.cancelarText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.guardar, busy && styles.disabled]}
              onPress={submit}
              disabled={busy}
            >
              <Text style={styles.guardarText}>
                {busy ? 'Reabriendo…' : 'Reabrir reporte'}
              </Text>
            </Pressable>
          </View>
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
  resumen: {
    backgroundColor: '#F7FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  resumenTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  resumenMeta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 3,
  },
  aviso: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
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
  inputMultiline: {
    minHeight: 90,
  },
  contador: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: 3,
  },
  sugerenciasLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
    marginTop: 12,
    marginBottom: 6,
  },
  sugerencias: {
    gap: 6,
  },
  sugerencia: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#F7FAFB',
  },
  sugerenciaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
  },
  botones: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  cancelar: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelarText: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 13,
  },
  guardar: {
    flex: 1.4,
    backgroundColor: colors.warning,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  guardarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  disabled: {
    opacity: 0.6,
  },
});
