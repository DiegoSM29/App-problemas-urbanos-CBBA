import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import { useNotifications } from '../context/NotificationsContext';
import AboutModal from './AboutModal';

export default function AccountModal({ visible, onClose }) {
  const { user, profile, logout } = useAuth();
  const { reports, loading, refresh } = useReports();
  const { unread } = useNotifications();
  const [about, setAbout] = useState(false);

  // Diagnóstico bajo demanda: solo se consulta cuando el usuario lo pide,
  // para no gastar una petición en cada apertura del perfil.
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState(null);

  const runCheck = async () => {
    setChecking(true);
    setCheck(null);
    await refresh();
    setCheck({
      role: profile?.role ?? 'Ciudadano',
      codigo: profile?.codigo ?? '—',
      reports: reports.length,
    });
    setChecking(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false}>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.eyebrow}>MI CUENTA</Text>
          <Text style={styles.title}>Perfil de usuario</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Código</Text>
            <Text style={styles.value}>{profile?.codigo ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Correo</Text>
            <Text style={styles.value}>{user?.email ?? '—'}</Text>
          </View>
          {!!profile?.nombre && (
            <View style={styles.row}>
              <Text style={styles.label}>Nombre</Text>
              <Text style={styles.value}>{profile.nombre}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Rol</Text>
            <Text style={styles.value}>{profile?.role ?? 'Ciudadano'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Notificaciones sin leer</Text>
            <Text style={styles.value}>{unread}</Text>
          </View>

          <Pressable style={styles.linkButton} onPress={() => setAbout(true)}>
            <Text style={styles.linkText}>Acerca de la aplicación</Text>
          </Pressable>

          <Pressable
            style={styles.diagnosticButton}
            onPress={runCheck}
            disabled={checking || loading}
          >
            <Text style={styles.diagnosticText}>
              {checking || loading ? 'Comprobando…' : 'Comprobar mi acceso'}
            </Text>
          </Pressable>

          {!!check && (
            <View style={styles.diagnosticBox}>
              <Text style={styles.diagnosticLine}>
                Rol detectado: <Text style={styles.diagnosticValue}>{check.role}</Text>
              </Text>
              <Text style={styles.diagnosticLine}>
                Código: <Text style={styles.diagnosticValue}>{check.codigo}</Text>
              </Text>
              <Text style={styles.diagnosticLine}>
                Reportes que puedes ver:{' '}
                <Text style={styles.diagnosticValue}>{check.reports}</Text>
              </Text>
              {check.reports === 0 && (
                <Text style={styles.diagnosticWarn}>
                  Si esperabas ver reportes, ejecuta supabase/verificar.sql en
                  el SQL Editor: lo más probable es que falte la política que
                  permite al administrador leerlos todos.
                </Text>
              )}
            </View>
          )}

          <Pressable
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              onClose();
            }}
          >
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
          </ScrollView>
        </View>
      </View>

      <AboutModal visible={about} onClose={() => setAbout(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 54, 83, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 26,
  },
  close: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  closeText: {
    fontSize: 28,
    color: colors.textFaint,
    fontWeight: '700',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F5',
  },
  label: {
    fontSize: 13,
    color: colors.textFaint,
    fontWeight: '700',
  },
  value: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '800',
  },
  linkButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  diagnosticButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  diagnosticText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  diagnosticBox: {
    marginTop: 12,
    backgroundColor: '#F3F7F8',
    borderRadius: 10,
    padding: 13,
  },
  diagnosticLine: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 19,
  },
  diagnosticValue: {
    fontWeight: '800',
    color: colors.text,
  },
  diagnosticWarn: {
    marginTop: 9,
    fontSize: 11,
    lineHeight: 17,
    color: colors.danger,
  },
  logoutButton: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 14,
  },
});