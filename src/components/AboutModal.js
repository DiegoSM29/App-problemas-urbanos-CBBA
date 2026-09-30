import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, statusColor, statuses } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { EDIT_WINDOW_HOURS } from '../lib/limits';

// Explicación de la aplicación.
//
// Antes, la tarjeta "Información" del inicio navegaba a 'Inicio', es
// decir, no pasaba nada. Este modal es la respuesta: una pantalla
// aparte que explica qué es la app, cómo funciona el flujo y qué puede
// hacer cada rol, incluido el que está mirando.

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children, icon = '•' }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletIcon}>{icon}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Step({ number, title, text, color }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepBadge, { backgroundColor: color }]}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{text}</Text>
      </View>
    </View>
  );
}

// Qué puede hacer cada rol, según quién esté mirando.
const POR_ROL = {
  Ciudadano: [
    'Reportas una incidencia con descripción, categoría, ubicación y foto.',
    `Puedes corregir lo que escribiste durante ${
      EDIT_WINDOW_HOURS === 1 ? 'la primera hora' : `las primeras ${EDIT_WINDOW_HOURS} horas`
    }, siempre que el municipio todavía no lo haya tomado.`,
    'Sigues el avance desde "Mis reportes" sin gestionar nada.',
    'Recibes un aviso cuando el técnico termina, con sus palabras de cierre.',
    'Si cambian de técnico, lo ves en el historial del reporte.',
  ],
  Técnico: [
    'Ves solo los trabajos que te asignó el municipio.',
    'Registras qué hiciste, qué materiales usaste y una foto de evidencia.',
    'Escribes unas palabras para el ciudadano con el resultado.',
    'Tu informe aparece en el reporte del ciudadano al cerrarse.',
  ],
  Administrador: [
    'Ves todos los reportes de la ciudadanía en un solo panel.',
    'Asignas cada reporte a un técnico de la cuadrilla.',
    'Puedes cambiar de técnico si el trabajo no avanza, y queda registrado.',
    'Actualizas el estado: Pendiente, En proceso o Resuelto.',
  ],
};

export default function AboutModal({ visible, onClose }) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'Ciudadano';
  const puntos = POR_ROL[role] ?? POR_ROL.Ciudadano;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>COCHABAMBA TE ESCUCHA</Text>
              <Text style={styles.title}>Sobre la aplicación</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            <Text style={styles.lead}>
              Es la plataforma municipal para reportar y dar seguimiento a los
              problemas de la ciudad: baches, alumbrado, basura, agua, áreas
              verdes, señalización y más. La ciudadanía reporta, el municipio
              organiza el trabajo y los técnicos lo ejecutan, todo en el mismo
              lugar.
            </Text>

            <Section title="Cómo funciona, paso a paso">
              <Step
                number="1"
                color={colors.accent}
                title="La ciudadanía reporta"
                text="Describe el problema, marca en el mapa dónde está y, si quiere, adjunta una foto."
              />
              <Step
                number="2"
                color={colors.purple}
                title="El municipio revisa y asigna"
                text="El administrador ve todos los reportes y le asigna uno de sus técnicos."
              />
              <Step
                number="3"
                color={colors.warning}
                title="El técnico trabaja"
                text="Atiende la incidencia y registra el informe, los materiales y una foto del trabajo."
              />
              <Step
                number="4"
                color={colors.success}
                title="Se avisa a la ciudadanía"
                text="Al cerrarse el reporte, quien lo reportó recibe un aviso y puede leer cómo quedó."
              />
            </Section>

            <Section title="Los tres estados">
              {statuses.map((s) => (
                <View key={s} style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor[s] }]} />
                  <View style={styles.statusText}>
                    <Text style={styles.statusName}>{s}</Text>
                    <Text style={styles.statusHint}>
                      {s === 'Pendiente'
                        ? 'Esperando que el municipio lo tome. Es el único estado en el que el ciudadano puede corregir su reporte.'
                        : s === 'En proceso'
                        ? 'Un técnico ya está trabajando en ello.'
                        : 'La incidencia fue atendida. Aquí aparecen las palabras de cierre del técnico.'}
                    </Text>
                  </View>
                </View>
              ))}
            </Section>

            <Section title={`Qué puedes hacer tú (${role})`}>
              {puntos.map((p) => (
                <Bullet key={p}>{p}</Bullet>
              ))}
            </Section>

            <Section title="Novedades">
              <Bullet icon="✎">
                {`Ahora puedes editar tu reporte durante ${
                  EDIT_WINDOW_HOURS === 1
                    ? 'la primera hora'
                    : `las primeras ${EDIT_WINDOW_HOURS} horas`
                }, no solo mientras siga pendiente.`}
              </Bullet>
              <Bullet icon="🔔">
                Tienes una bandeja de notificaciones: te avisa cuando llega un
                reporte nuevo, cuando te asignan uno y cuando resuelven los tuyos.
              </Bullet>
              <Bullet icon="💬">
                El técnico te escribe unas palabras al terminar, para que sepas
                cómo quedó el problema.
              </Bullet>
              <Bullet icon="⇄">
                Si un técnico no puede hacer el trabajo, el municipio puede
                cambiarlo. Ese cambio queda visible en el historial del reporte.
              </Bullet>
            </Section>

            <Text style={styles.footer}>
              Proyecto educativo · Expo (React Native) + Supabase
            </Text>
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 54, 83, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 5,
  },
  title: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  close: {
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 26,
    color: colors.textFaint,
    fontWeight: '700',
  },
  scroll: {
    paddingBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 6,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 11,
  },
  step: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 11,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
  },
  statusText: {
    flex: 1,
  },
  statusName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 2,
  },
  bullet: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 9,
  },
  bulletIcon: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '900',
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  footer: {
    marginTop: 20,
    fontSize: 11,
    color: colors.placeholder,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
