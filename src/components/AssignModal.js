import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { LIMITS, MOTIVOS_REASIGNACION } from '../lib/limits';

// Asignar o cambiar el técnico de un reporte.
//
// Sustituye a los chips horizontales que había antes. Con los chips se
// podía cambiar de técnico, pero no había forma de saber a quién se le
// quitaba el trabajo ni por qué, y el cambio quedaba sin rastro para el
// ciudadano. Aquí la lista muestra nombre y código, y el motivo (aunque
// opcional) deja constancia de la decisión.

export default function AssignModal({
  visible,
  report,
  technicians,
  onClose,
  onConfirm,
}) {
  const [selected, setSelected] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!visible || !report) return null;

  const actualId = report.tecnico_id ?? null;
  const esReasignacion = !!actualId;

  // Al cambiar de reporte se limpia lo que se había quedado escrito, para
  // no mandar el motivo de uno en el siguiente.
  const cerrar = () => {
    setSelected(null);
    setMotivo('');
    setError('');
    setBusy(false);
    onClose();
  };

  const confirmar = async () => {
    if (selected === null) {
      setError('Elige un técnico de la lista.');
      return;
    }
    // Se puede quitar al técnico actual, pero no elegir a otro que ya esté
    // asignado (eso no sería un cambio).
    if (selected === actualId) {
      setError('Ese técnico ya está asignado a este reporte.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const tecnico = technicians.find((t) => t.id === selected);
      await onConfirm(
        report.id,
        selected,
        tecnico?.nombre ?? tecnico?.email ?? '',
        motivo
      );
      setSelected(null);
      setMotivo('');
      onClose();
    } catch (e) {
      setError(e?.message ?? 'No se pudo asignar el técnico.');
    } finally {
      setBusy(false);
    }
  };

  const quitar = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(report.id, null, null, motivo);
      setSelected(null);
      setMotivo('');
      onClose();
    } catch (e) {
      setError(e?.message ?? 'No se pudo quitar el técnico.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {esReasignacion ? 'Cambiar técnico' : 'Asignar técnico'}
            </Text>
            <Pressable onPress={cerrar} hitSlop={10}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.reportBox}>
            <Text style={styles.reportTitle} numberOfLines={1}>
              {report.title}
            </Text>
            <Text style={styles.reportMeta}>
              {report.place} · {report.category}
            </Text>
            {!!report.tecnico_nombre && (
              <Text style={styles.current}>
                Asignado ahora a: {report.tecnico_nombre}
              </Text>
            )}
          </View>

          <Text style={styles.label}>CUADRILLA</Text>

          {!technicians?.length ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                No hay técnicos registrados. Crea cuentas con rol Técnico en
                Supabase y ejecuta supabase/tecnicos.sql.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {technicians.map((t) => {
                const isCurrent = t.id === actualId;
                const active = selected === t.id;

                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelected(t.id)}
                    disabled={busy}
                    style={[
                      styles.option,
                      active && styles.optionActive,
                      isCurrent && styles.optionCurrent,
                    ]}
                  >
                    <View
                      style={[
                        styles.radio,
                        active && styles.radioActive,
                      ]}
                    >
                      {active && <Text style={styles.radioDot}>✓</Text>}
                    </View>
                    <View style={styles.optionText}>
                      <Text
                        style={[
                          styles.optionName,
                          active && styles.optionNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {t.nombre || t.email}
                      </Text>
                      {!!t.codigo && (
                        <Text style={styles.optionCode}>{t.codigo}</Text>
                      )}
                    </View>
                    {isCurrent && (
                      <Text style={styles.currentTag}>Actual</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {esReasignacion && (
            <>
              <Text style={styles.label}>MOTIVO (OPCIONAL)</Text>
              <View style={styles.reasons}>
                {MOTIVOS_REASIGNACION.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMotivo(m)}
                    style={[styles.reason, motivo === m && styles.reasonActive]}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        motivo === m && styles.reasonTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="O escribe el motivo…"
                placeholderTextColor={colors.placeholder}
                maxLength={LIMITS.motivoReasignacion}
                value={motivo}
                onChangeText={setMotivo}
                editable={!busy}
                multiline
              />
              <Text style={styles.counter}>
                {motivo.length}/{LIMITS.motivoReasignacion}
              </Text>
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            {esReasignacion && (
              <Pressable
                style={[styles.secondary, busy && styles.disabled]}
                onPress={quitar}
                disabled={busy}
              >
                <Text style={styles.secondaryText}>Quitar técnico</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.save, busy && styles.disabled]}
              onPress={confirmar}
              disabled={busy}
            >
              <Text style={styles.saveText}>
                {busy
                  ? 'Guardando…'
                  : esReasignacion
                    ? 'Cambiar técnico'
                    : 'Asignar'}
              </Text>
            </Pressable>
          </View>

          {esReasignacion && (
            <Text style={styles.footnote}>
              El ciudadano verá en su reporte que cambió de técnico, con la
              fecha y el motivo si escribiste uno.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 54, 83, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },
  closeText: {
    fontSize: 26,
    color: colors.textFaint,
    fontWeight: '700',
  },
  reportBox: {
    backgroundColor: '#F7FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  reportMeta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 3,
  },
  current: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 6,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 9,
  },
  list: {
    maxHeight: 250,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 8,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: '#F1F8FC',
  },
  optionCurrent: {
    backgroundColor: '#F3F7F8',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioDot: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  optionNameActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  optionCode: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textFaint,
    marginTop: 2,
  },
  currentTag: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textFaint,
    letterSpacing: 0.6,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  reason: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  reasonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: 4,
  },
  warn: {
    backgroundColor: '#F3F7F8',
    borderRadius: 10,
    padding: 13,
  },
  warnText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 13,
  },
  save: {
    flex: 2,
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
  footnote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textFaint,
    textAlign: 'center',
  },
});
