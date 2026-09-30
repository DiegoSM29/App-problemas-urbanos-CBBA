import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Alta de ciudadanos.
//
// El formulario NO tiene campo de rol a propósito. No es una decisión de
// diseño: aunque alguien lo añadiera, el rol lo escribe siempre la base de
// datos (trigger handle_new_user) como 'Ciudadano', así que la app no puede
// crear un administrador ni por error.
export default function RegisterModal({ visible, onClose }) {
  const { register } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setListo(null);
  }, [visible]);

  const validEmail = String(email).includes('@') && String(email).includes('.');

  const submit = async () => {
    if (nombre.trim().length < 3) {
      setError('Escribe tu nombre completo (mínimo 3 letras).');
      return;
    }
    if (!validEmail) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const correo = email.trim();
      const { needsEmailConfirmation } = await register({
        nombre: nombre.trim(),
        email: correo,
        password,
      });
      setNombre('');
      setEmail('');
      setPassword('');
      setConfirm('');
      if (needsEmailConfirmation) {
        // Se guarda el correo aparte porque el campo ya se vació, y el
        // mensaje de "revisa tu correo" lo necesita.
        setListo(correo);
      } else {
        // Entra directo: la sesión ya está activa y el App.js cambia de
        // pantalla solo, así que no hay nada que cerrar a mano.
        onClose();
      }
    } catch (e) {
      setError(e.message || 'No se pudo crear la cuenta.');
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

          {listo ? (
            <View>
              <Text style={styles.eyebrow}>CUENTA CREADA</Text>
              <Text style={styles.title}>Revisa tu correo</Text>
              <Text style={styles.description}>
                Te enviamos un mensaje a {listo} para confirmar la cuenta.
                Cuando confirmes, ya podrás entrar con tu correo y contraseña.
              </Text>
              <Pressable style={styles.primaryButton} onPress={onClose}>
                <Text style={styles.primaryButtonText}>Entendido</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.eyebrow}>NUEVA CUENTA</Text>
              <Text style={styles.title}>Regístrate como ciudadano</Text>
              <Text style={styles.description}>
                Con esta cuenta reportas incidencias y sigues su avance. Las
                cuentas de administrador y técnico las crea el municipio.
              </Text>

              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. María Fernández"
                placeholderTextColor={colors.placeholder}
                value={nombre}
                onChangeText={setNombre}
                editable={!busy}
              />

              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@correo.com"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />

              <Text style={styles.fieldLabel}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />

              <Text style={styles.fieldLabel}>Repetir contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                editable={!busy}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.roleNote}>
                <Text style={styles.roleNoteTitle}>Tu rol: Ciudadano</Text>
                <Text style={styles.roleNoteText}>
                  Puedes reportar incidencias y ver el estado de tus reportes.
                </Text>
              </View>

              <Pressable
                style={[styles.primaryButton, busy && styles.disabled]}
                onPress={submit}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Creando cuenta…' : 'Crear mi cuenta'}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
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
  roleNote: {
    marginTop: 16,
    backgroundColor: colors.hero,
    borderRadius: 10,
    padding: 12,
  },
  roleNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  roleNoteText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
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
});
