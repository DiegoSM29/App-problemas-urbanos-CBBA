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
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { exampleAccounts } from '../services/db';

export default function LoginModal({ visible, onClose }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setError('');
  }, [visible]);

  const fill = (account) => {
    setIdentifier(account.email);
    setPassword(account.password);
    setError('');
  };

  const submit = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Introduce tu código (o correo) y tu contraseña.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(identifier.trim(), password);
      setIdentifier('');
      setPassword('');
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo iniciar sesión.');
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
          <Text style={styles.title}>Bienvenido a Civica</Text>
          <Text style={styles.description}>
            Introduce tu código y contraseña. El sistema te llevará a tu espacio
            según tu cuenta (ciudadano, administrador o técnico).
          </Text>

          <Text style={styles.fieldLabel}>Código o correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. ADM-0001 o admin@demo.bo"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
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

          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? 'Procesando…' : 'Ingresar'}
            </Text>
          </Pressable>

          <View style={styles.hints}>
            <Text style={styles.hintsTitle}>CUENTAS YA CREADAS (toca para usar)</Text>
            {exampleAccounts.map((account) => (
              <Pressable
                key={account.email}
                onPress={() => fill(account)}
                disabled={busy}
                style={styles.hintRow}
              >
                <View style={styles.hintInfo}>
                  <Text style={styles.hintRole}>
                    {account.role} · {account.nombre}
                  </Text>
                  <Text style={styles.hintCred}>
                    {account.codigo} · {account.email} · {account.password}
                  </Text>
                </View>
                <Text style={styles.hintUse}>Usar</Text>
              </Pressable>
            ))}
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
  hints: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F7FBFD',
  },
  hintsTitle: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 8,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#E4EFF4',
  },
  hintInfo: {
    flex: 1,
  },
  hintRole: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  hintCred: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  hintUse: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
});
