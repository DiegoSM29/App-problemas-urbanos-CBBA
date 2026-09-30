import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
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
import {
  LIMITS,
  MAX_IMAGE_MB,
  CIERRES,
  editWindow,
  formatRemaining,
} from '../lib/limits';
import { MIN_MENSAJE_FINAL } from '../services/reports';
import { summarizeAssignments } from '../services/asignaciones';
import {
  pickFromLibrary,
  captureFromCamera,
  previewUri,
} from '../services/images';
import AssignModal from './AssignModal';

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

// Botón que abre el modal de asignación. Se muestra siempre en el panel
// del administrador, tanto si el reporte no tiene técnico como si ya tiene
// uno (en ese caso el título dice "Cambiar técnico").
function AssignButton({ report, technicians, onAssign }) {
  const [open, setOpen] = useState(false);
  const asignado = !!report.tecnico_id;

  return (
    <>
      <Pressable
        style={styles.assignButton}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.assignButtonText}>
          {asignado ? '⇄ Cambiar técnico' : '✚ Asignar técnico'}
        </Text>
      </Pressable>

      <AssignModal
        visible={open}
        report={report}
        technicians={technicians}
        onClose={() => setOpen(false)}
        onConfirm={onAssign}
      />
    </>
  );
}

// Historial de cambios de técnico.
//
// Se le enseña al ciudadano con frases, porque lo que le importa es si le
// cambiaron a quién le tocaba arreglar su problema, no una tabla de
// eventos con nombres de columnas.
function AssignmentHistory({ assignments, plain = false }) {
  const resumen = summarizeAssignments(assignments);
  if (!resumen) return null;

  return (
    <View style={plain ? styles.changeBox : styles.changeBoxAdmin}>
      <Text style={styles.changeLabel}>CAMBIO DE TÉCNICO</Text>
      <Text style={styles.changeText}>
        Este reporte fue reasignado {resumen.total}{' '}
        {resumen.total === 1 ? 'vez' : 'veces'}. Lo atendía{' '}
        {resumen.de ?? 'otro técnico'} y ahora está a cargo de{' '}
        {resumen.a ?? 'otro técnico'}.
      </Text>
      {!!resumen.motivo && (
        <Text style={styles.changeMotivo}>Motivo: {resumen.motivo}</Text>
      )}
      <Text style={styles.changeTime}>{resumen.time}</Text>
    </View>
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
  onReopen,
  citizen,
  assignments,
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
    cierre_resultado,
    mensaje_final,
    mensaje_final_at,
    editado_at,
    reapertura_motivo,
    reapertura_at,
    reaperturas,
  } = report;

  const [open, setOpen] = useState(false);
  const [work, setWork] = useState(informe ?? '');
  const [materials, setMaterials] = useState(materiales ?? '');
  const [finalStatus, setFinalStatus] = useState('Resuelto');
  const [workImage, setWorkImage] = useState(report.informe_image_url ?? null);
  const [workImageAsset, setWorkImageAsset] = useState(null);
  const [workError, setWorkError] = useState('');
  const [busy, setBusy] = useState(false);

  // Resultado del trabajo y palabras para el ciudadano.
  const [cierre, setCierre] = useState(cierre_resultado ?? 'Resuelto');
  const [mensaje, setMensaje] = useState(mensaje_final ?? '');

  const canReport = technician && status !== 'Resuelto' && onComplete;

  // La ventana de edición la calcula el servicio al traducir la fila, así
  // que aquí ya viene resuelto y con su explicación.
  const edit = report.editWindow ?? { editable: false, reason: '' };
  const editable = edit.editable;

  // El servicio calcula la ventana una sola vez, al leer la lista. Para
  // que la cuenta atrás baje sola hace falta que algo vuelva a renderizar
  // la tarjeta; este reloj es ese algo. Se detiene apenas deja de hacer
  // falta, y por eso solo se programa si la ventana sigue abierta.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!citizen || !editable) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [citizen, editable]);

  // Ventana recalculada contra el reloj de la tarjeta, no contra el valor
  // que quedó congelado cuando se cargó la lista.
  const ventana = editWindow({ status, created_at: report.created_at }, now);
  const editVivo = ventana.editable && !ventana.unknown;

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
    const texto = mensaje.trim();

    // Marcar como resuelto sin dejar una palabra deja al ciudadano sin
    // saber qué pasó, que es justo lo que pedía la mejora. Se exige solo
    // en ese caso: si el trabajo sigue en proceso no hace falta.
    if (finalStatus === 'Resuelto' && texto.length < MIN_MENSAJE_FINAL) {
      setWorkError(
        `Escribe al menos ${MIN_MENSAJE_FINAL} caracteres para el ciudadano: así sabrá cómo quedó el problema.`
      );
      return;
    }

    setBusy(true);
    setWorkError('');
    try {
      await onComplete(report.id, {
        informe: work.trim(),
        materiales: materials.trim(),
        status: finalStatus,
        imageAsset: workImageAsset,
        informeImageUrl: workImage,
        cierre_resultado: cierre,
        mensaje_final: texto,
      });
      setOpen(false);
    } catch (e) {
      setWorkError(e?.message ?? 'No se pudo guardar el informe.');
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
          {/*
            El botón de reabrir va aparte del de editar a propósito: los dos
            se apoiaron en la misma columna por un momento y quedaban uno
            debajo del otro, con el mismo aspecto, que es justo lo que hace
            que uno se pulse sin querer. Ahora cada acción tiene su botón y
            su color.
          */}
          {citizen && onReopen && status === 'Resuelto' && (
            <Pressable style={styles.reopenButton} onPress={() => onReopen(report)}>
              <Text style={styles.reopenButtonText}>↺ Reabrir</Text>
            </Pressable>
          )}
          {citizen && !editable && (
            <Text style={styles.lockedHint}>No editable</Text>
          )}
        </View>
      </Pressable>

      {/* Cuenta atrás de la ventana de edición. */}
      {citizen && ventana.editable && !ventana.unknown && (
        <Text style={styles.editWindow}>
          ⏱ Puedes corregirlo {formatRemaining(ventana.remainingMs)} más
        </Text>
      )}
      {citizen && !ventana.editable && !!ventana.reason && (
        <Text style={styles.editedAt}>{ventana.reason}</Text>
      )}
      {citizen && !!editado_at && (
        <Text style={styles.editedAt}>Editado por ti · {editado_at}</Text>
      )}

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
          <AssignButton
            report={report}
            technicians={technicians}
            onAssign={onAssign}
          />
        </View>
      ) : null}

      {/* El historial solo aparece si hubo reasignaciones de verdad. */}
      {!!assignments?.length && (
        <AssignmentHistory
          assignments={assignments}
          plain={!admin && !technician}
        />
      )}

      {/*
        El aviso de reapertura va arriba del informe, antes que el mensaje
        del técnico: es lo último que pasó con el reporte y lo primero que
        el municipio necesita leer de arriba abajo. Al ciudadano se le dice
        que lo abrió él; al administrador, que fue la ciudadanía.
      */}
      {!!reapertura_motivo && (
        <View style={styles.reopenBox}>
          <View style={styles.reopenHead}>
            <Text style={styles.reopenLabel}>
              {citizen && !admin ? 'REABIERTO POR TI' : 'REABIERTO POR LA CIUDADANÍA'}
            </Text>
            {reaperturas > 1 && (
              <View style={styles.reopenTag}>
                <Text style={styles.reopenTagText}>
                  {reaperturas} veces
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.reopenText}>{reapertura_motivo}</Text>
          {!!reapertura_at && (
            <Text style={styles.reopenTime}>{reapertura_at}</Text>
          )}
          {!citizen && (
            <Text style={styles.reopenHint}>
              Volvió a la cola del municipio. El técnico que lo atiende se
              mantiene.
            </Text>
          )}
        </View>
      )}

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

      {/* Palabras del técnico para el ciudadano. Van destacadas y con
          atribución clara, porque es un mensaje personal y no el parte
          técnico. */}
      {!!mensaje_final && (
        <View style={styles.finalMessageBox}>
          <View style={styles.finalMessageHead}>
            <Text style={styles.finalMessageLabel}>MENSAJE DEL TÉCNICO</Text>
            {!!cierre_resultado && (
              <View style={styles.finalMessageTag}>
                <Text style={styles.finalMessageTagText}>{cierre_resultado}</Text>
              </View>
            )}
          </View>
          <Text style={styles.finalMessageText}>{mensaje_final}</Text>
          {!!tecnico_nombre && (
            <Text style={styles.finalMessageAuthor}>— {tecnico_nombre}</Text>
          )}
          {!!mensaje_final_at && (
            <Text style={styles.finalMessageTime}>{mensaje_final_at}</Text>
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

          {/* Resultado y palabras para el ciudadano. */}
          <Text style={styles.fieldLabel}>¿Cómo terminó el trabajo?</Text>
          <View style={styles.cierreRow}>
            {CIERRES.map((c) => {
              const active = cierre === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCierre(c)}
                  style={[styles.cierreChip, active && styles.cierreChipActive]}
                >
                  <Text
                    style={[
                      styles.cierreText,
                      active && styles.cierreTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>
            Palabras para el ciudadano (máx. {LIMITS.mensajeFinal})
          </Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Ej. Se reparó el bache con cemento y ya está transitable…"
            placeholderTextColor={colors.placeholder}
            multiline
            maxLength={LIMITS.mensajeFinal}
            value={mensaje}
            onChangeText={setMensaje}
            editable={!busy}
          />
          <Text style={styles.counter}>
            {mensaje.length}/{LIMITS.mensajeFinal}
          </Text>
          <Text style={styles.helper}>
            Esto es lo que leerá quien reportó el problema al cerrarse.
          </Text>

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
  reopenButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FEF6E7',
  },
  reopenButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B5761A',
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
  helper: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 5,
    lineHeight: 15,
  },
  // Resultado del trabajo
  cierreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cierreChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#F3F7F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cierreChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  cierreText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  cierreTextActive: {
    color: '#FFFFFF',
  },
  // Mensaje de cierre del técnico
  finalMessageBox: {
    marginTop: 12,
    backgroundColor: '#E9F7F1',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  finalMessageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  finalMessageLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '900',
    color: colors.secondary,
  },
  finalMessageTag: {
    backgroundColor: colors.secondary,
    borderRadius: 9,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  finalMessageTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  finalMessageText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  finalMessageAuthor: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 9,
  },
  finalMessageTime: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 3,
  },
  // Reapertura del reporte por el ciudadano
  reopenBox: {
    marginTop: 12,
    backgroundColor: '#FEF6E7',
    borderRadius: 10,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  reopenHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  reopenLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '900',
    color: '#B5761A',
  },
  reopenTag: {
    backgroundColor: colors.warning,
    borderRadius: 9,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  reopenTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  reopenText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  reopenTime: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 5,
  },
  reopenHint: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 8,
  },
  // Ventana de edición
  editWindow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    marginTop: 7,
  },
  editedAt: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 3,
  },
  // Cambio de técnico
  assignButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#F7FBFD',
  },
  assignButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  changeBox: {
    marginTop: 12,
    backgroundColor: '#F4F1FD',
    borderRadius: 10,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: colors.purple,
  },
  changeBoxAdmin: {
    marginTop: 12,
    backgroundColor: '#F4F1FD',
    borderRadius: 10,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: colors.purple,
  },
  changeLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '900',
    color: colors.purple,
    marginBottom: 6,
  },
  changeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  changeMotivo: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 6,
    fontWeight: '700',
  },
  changeTime: {
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 5,
  },
});
