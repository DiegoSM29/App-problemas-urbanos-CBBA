import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  colors,
  categoryIcon,
  categoryColor,
  toneColor,
  statusColor,
  statuses,
} from '../theme/colors';
import { LIMITS, MAX_IMAGE_MB } from '../lib/limits';
import {
  pickFromLibrary,
  captureFromCamera,
  previewUri,
} from '../services/images';

function StatusSelect({ value, onChange }) {
  return (
    <View style={styles.statusRow}>
      {statuses.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[
              styles.statusOption,
              active && { backgroundColor: statusColor[o], borderColor: statusColor[o] },
            ]}
          >
            <Text style={[styles.statusOptionText, active && styles.statusOptionTextActive]}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TechnicianAssign({ technicians, value, onAssign }) {
  if (!technicians?.length) {
    return (
      <Text style={styles.hint}>
        No hay técnicos registrados. Crea cuentas con rol Técnico.
      </Text>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {technicians.map((t) => {
        const active = value === t.id;
        const label = t.nombre || t.email || t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onAssign(t.id, label)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {active ? `✓ ${label}` : label}
            </Text>
            {!!t.codigo && (
              <Text
                style={[
                  styles.chipCode,
                  active && styles.chipTextActive,
                ]}
              >
                {t.codigo}
              </Text>
            )}
          </Pressable>
        );
      })}
      <Text style={styles.chipCount}>
        {technicians.length} técnico{technicians.length === 1 ? '' : 's'}
      </Text>
    </ScrollView>
  );
}

export default function ReportCard({
  report,
  onStatusChange,
  admin,
  onPress,
  technicians,
  onAssign,
  technician,
  onComplete,
  onEdit,
  citizen,
}) {
  const {
    title,
    category,
    place,
    status,
    tone,
    time,
    image_url,
    tecnico_nombre,
    informe,
    materiales,
  } = report;

  const [open, setOpen] = useState(false);
  const [work, setWork] = useState(informe ?? '');
  const [materials, setMaterials] = useState(materiales ?? '');
  const [finalStatus, setFinalStatus] = useState('Resuelto');
  const [workImage, setWorkImage] = useState(report.informe_image_url ?? null);
  const [workImageAsset, setWorkImageAsset] = useState(null);
  const [workError, setWorkError] = useState('');
  const [busy, setBusy] = useState(false);

  const canReport = technician && status !== 'Resuelto' && onComplete;

  // El ciudadano solo puede corregir su reporte mientras siga pendiente.
  const editable = status === 'Pendiente';

  const chooseWorkImage = async (picker) => {
    setWorkError('');
    try {
      const result = await picker();
      if (result.canceled) return;
      if (!result.ok) {
        setWorkError(result.error);
        return;
      }
      setWorkImageAsset(result.asset);
      setWorkImage(previewUri(result.asset));
    } catch {
      setWorkError('No se pudo adjuntar la foto.');
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onComplete(report.id, {
        informe: work.trim(),
        materiales: materials.trim(),
        status: finalStatus,
        imageAsset: workImageAsset,
        informeImageUrl: workImage,
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.topRow} onPress={onPress}>
        <View
          style={[
            styles.thumb,
            { backgroundColor: `${categoryColor[category] ?? colors.primary}18` },
          ]}
        >
          <Text
            style={[
              styles.thumbIcon,
              { color: categoryColor[category] ?? colors.primary },
            ]}
          >
            {categoryIcon[category] ?? '●'}
          </Text>
        </View>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {place}  ·  {category}
          </Text>
          {!!tecnico_nombre && (
            <Text style={styles.assigned}>Técnico: {tecnico_nombre}</Text>
          )}
          <Text style={styles.date}>{time}</Text>
        </View>
        <View style={styles.statusArea}>
          <View
            style={[
              styles.badge,
              { backgroundColor: `${toneColor[tone] ?? colors.primary}18` },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: toneColor[tone] ?? colors.primary },
              ]}
            >
              {status}
            </Text>
          </View>
          {admin && onStatusChange ? (
            <StatusSelect
              value={status}
              onChange={(s) => onStatusChange(report.id, s)}
            />
          ) : null}
          {canReport && (
            <Pressable
              style={styles.reportButton}
              onPress={() => setOpen((v) => !v)}
            >
              <Text style={styles.reportButtonText}>
                {open ? 'Cerrar' : informe ? 'Editar informe' : 'Llenar informe'}
              </Text>
            </Pressable>
          )}
          {citizen && onEdit && editable && (
            <Pressable style={styles.editButton} onPress={() => onEdit(report)}>
              <Text style={styles.editButtonText}>✎ Editar</Text>
            </Pressable>
          )}
          {citizen && !editable && (
            <Text style={styles.lockedHint}>No editable</Text>
          )}
        </View>
      </Pressable>

      {!!image_url && (
        <Image
          source={{ uri: image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {admin && onAssign ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ASIGNAR TÉCNICO</Text>
          <TechnicianAssign
            technicians={technicians}
            value={report.tecnico_id}
            onAssign={(id, nombre) => onAssign(report.id, id, nombre)}
          />
        </View>
      ) : null}

      {!!informe && (
        <View style={styles.reportBox}>
          <Text style={styles.reportTitle}>Informe de trabajo</Text>
          <Text style={styles.reportText}>{informe}</Text>
          {!!materiales && (
            <>
              <Text style={[styles.reportTitle, styles.reportTitleSpaced]}>
                Materiales utilizados
              </Text>
              <Text style={styles.reportText}>{materiales}</Text>
            </>
          )}
          {!!report.informe_image_url && (
            <Image
              source={{ uri: report.informe_image_url }}
              style={styles.workImage}
              resizeMode="cover"
            />
          )}
        </View>
      )}

      {canReport && open ? (
        <View style={styles.form}>
          <Text style={styles.sectionLabel}>INFORME DEL TÉCNICO</Text>
          <Text style={styles.fieldLabel}>Trabajos realizados</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Describe qué trabajos realizaste..."
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={LIMITS.informe}
            value={work}
            onChangeText={setWork}
            editable={!busy}
          />
          <Text style={styles.counter}>
            {work.length}/{LIMITS.informe}
          </Text>
          <Text style={styles.fieldLabel}>Materiales utilizados</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 2 bolsas de cemento, pintura..."
            placeholderTextColor={colors.placeholder}
            maxLength={LIMITS.materiales}
            value={materials}
            onChangeText={setMaterials}
            editable={!busy}
          />
          <Text style={styles.counter}>
            {materials.length}/{LIMITS.materiales}
          </Text>
          <Text style={styles.fieldLabel}>
            Foto del trabajo (opcional, máx. {MAX_IMAGE_MB} MB)
          </Text>
          {workImage ? (
            <View style={styles.workImageWrap}>
              <Image
                source={{ uri: workImage }}
                style={styles.workImage}
                resizeMode="cover"
              />
              <Pressable
                style={styles.removeWorkImage}
                onPress={() => {
                  setWorkImage(null);
                  setWorkImageAsset(null);
                }}
                disabled={busy}
              >
                <Text style={styles.removeWorkImageText}>Quitar foto</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <Pressable
                style={[styles.photoButton, busy && styles.disabled]}
                onPress={() => chooseWorkImage(captureFromCamera)}
                disabled={busy}
              >
                <Text style={styles.photoButtonText}>📷 Tomar foto</Text>
              </Pressable>
              <Pressable
                style={[styles.photoButton, busy && styles.disabled]}
                onPress={() => chooseWorkImage(pickFromLibrary)}
                disabled={busy}
              >
                <Text style={styles.photoButtonText}>+ Galería</Text>
              </Pressable>
            </View>
          )}
          {!!workError && <Text style={styles.workError}>{workError}</Text>}
          <Text style={styles.fieldLabel}>Estado final</Text>
          <View style={styles.statusRowInline}>
            {['En proceso', 'Resuelto'].map((s) => {
              const active = finalStatus === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setFinalStatus(s)}
                  style={[
                    styles.statusOption,
                    active && {
                      backgroundColor: statusColor[s],
                      borderColor: statusColor[s],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      active && styles.statusOptionTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.saveButton, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.saveButtonText}>
              {busy ? 'Guardando…' : 'Guardar informe'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAF1F3',
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  thumbIcon: {
    fontSize: 18,
    fontWeight: '800',
  },
  main: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 3,
  },
  assigned: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 3,
  },
  date: {
    fontSize: 11,
    color: colors.placeholder,
    marginTop: 4,
  },
  statusArea: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 80,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'column',
    gap: 4,
    marginTop: 4,
  },
  statusRowInline: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaint,
  },
  statusOptionTextActive: {
    color: '#FFF',
  },
  reportButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  reportButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  editButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  editButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.secondary,
  },
  lockedHint: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.placeholder,
    marginTop: 4,
  },
  counter: {
    fontSize: 10,
    color: colors.placeholder,
    textAlign: 'right',
    marginTop: 3,
    marginBottom: -4,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F7FAFB',
  },
  photoButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  workImageWrap: {
    marginTop: 4,
  },
  workImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.hero,
  },
  removeWorkImage: {
    alignSelf: 'flex-start',
    marginTop: 7,
  },
  removeWorkImageText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  workError: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 8,
  },
  image: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    marginTop: 12,
    backgroundColor: colors.hero,
  },
  section: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F5',
    paddingTop: 10,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipCode: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textFaint,
    marginTop: 1,
  },
  chipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaint,
    alignSelf: 'center',
    paddingLeft: 4,
  },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
  },
  reportBox: {
    marginTop: 12,
    backgroundColor: '#F7FAFB',
    borderRadius: 10,
    padding: 12,
  },
  reportTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.text,
  },
  reportTitleSpaced: {
    marginTop: 10,
  },
  reportText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  form: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F5',
    paddingTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
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
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
