import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, roles } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({
  visible,
  mode,
  onClose,
  onSwitchMode,
  initialRole = 'Ciudadano',
}) {
  const { login, register, demo } = useAuth();
  const [role, setRole] = useState(initialRole);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  useEffect(() => {
    if (visible) {
      setRole(initialRole);
      setError('');
    }
  }, [visible, initialRole]);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo electrónico y contraseña.');
      return;
    }
    if (isRegister && role === 'Técnico' && !nombre.trim()) {
      setError('Ingresa el nombre del técnico.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (isRegister) await register(email.trim(), password, role, nombre.trim());
      else await login(email.trim(), password, role);
      setEmail('');
      setPassword('');
      setNombre('');
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.eyebrow}>ACCESO SEGURO</Text>
          <Text style={styles.title}>
            {isRegister ? 'Crear una cuenta' : 'Bienvenido a Civica'}
          </Text>
          <Text style={styles.description}>
            Ingresa para reportar, dar seguimiento o atender incidencias urbanas
            de Cochabamba.
          </Text>

          <View style={styles.roleSwitch}>
            {roles.map((r) => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleButton, active && styles.roleButtonActive]}
                >
                  <Text
                    style={active ? styles.roleTextActive : styles.roleText}
                    numberOfLines={1}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isRegister && (
            <>
              <Text style={styles.fieldLabel}>
                Nombre completo{role === 'Técnico' ? ' del técnico' : ' (opcional)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Carlos Mamani"
                placeholderTextColor={colors.placeholder}
                value={nombre}
                onChangeText={setNombre}
                editable={!busy}
              />
            </>
          )}

          <Text style={styles.fieldLabel}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <Text style={styles.fieldLabel}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          {demo && (
            <Text style={styles.demoNote}>
              Modo demostración (sin Supabase): usa cualquier correo y
              contraseña.
            </Text>
          )}

          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? 'Procesando…' : isRegister ? 'Crear cuenta' : 'Ingresar'}
            </Text>
          </Pressable>

          <Pressable onPress={onSwitchMode} style={styles.switch}>
            <Text style={styles.switchText}>
              {isRegister
                ? '¿Ya tienes cuenta? Iniciar sesión'
                : '¿No tienes cuenta? Regístrate'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    maxWidth: 420,
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
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginBottom: 18,
  },
  roleSwitch: {
    flexDirection: 'row',
    backgroundColor: '#F3F7F8',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: colors.primary,
  },
  roleText: {
    fontWeight: '700',
    color: colors.textFaint,
    fontSize: 12,
  },
  roleTextActive: {
    fontWeight: '800',
    color: '#FFFFFF',
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 6,
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
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 10,
  },
  demoNote: {
    color: colors.purple,
    fontSize: 11,
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  switch: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});