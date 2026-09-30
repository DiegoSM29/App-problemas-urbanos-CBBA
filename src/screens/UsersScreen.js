import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fetchAccounts } from '../services/auth';

// Pantalla exclusiva del administrador: alta de técnicos y administradores.
//
// No se puede crear ciudadanos desde aquí a propósito. Los ciudadanos se
// registran solos en la pantalla de bienvenida, y la Edge Function rechaza
// el rol 'Ciudadano' aunque alguien llame a la función saltándose la app.
const ROLES = [
  { value: 'Técnico', prefix: 'TEC', color: colors.success },
  { value: 'Administrador', prefix: 'ADM', color: colors.purple },
];

const EMPTY_FORM = {
  nombre: '',
  email: '',
  password: '',
  codigo: '',
  role: 'Técnico',
};

export default function UsersScreen() {
  const { createAccount } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exito, setExito] = useState('');

  const prefijoActual =
    ROLES.find((r) => r.value === form.role)?.prefix ?? 'TEC';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await fetchAccounts());
      setListError('');
    } catch (e) {
      setListError(e.message || 'No se pudo cargar el personal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setError('');
    setExito('');
  };

  const cambiarRol = (role) => {
    // El código se reinicia al cambiar de rol porque los prefijos no se
    // mezclan: un técnico no puede quedar con ADM-0007.
    setForm((f) => ({ ...f, role, codigo: '' }));
    setError('');
    setExito('');
  };

  const submit = async () => {
    if (form.nombre.trim().length < 3) {
      setError('Escribe el nombre completo (mínimo 3 letras).');
      return;
    }
    if (!form.email.includes('@') || !form.email.includes('.')) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setError('');
    setExito('');
    try {
      const creado = await createAccount({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
        codigo: form.codigo,
      });
      setExito(
        `Cuenta creada. ${creado.nombre} entra con el código ${creado.codigo} ` +
          `o con su correo.`
      );
      setForm(EMPTY_FORM);
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const tecnicos = accounts.filter((a) => a.role === 'Técnico');
  const administradores = accounts.filter((a) => a.role === 'Administrador');

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>GESTIÓN MUNICIPAL</Text>
      <Text style={styles.title}>Personal</Text>
      <Text style={styles.description}>
        Crea las cuentas de técnicos y administradores. Los ciudadanos no se
        crean aquí: se registran solos desde la pantalla de inicio y siempre
        entran como ciudadanos.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nueva cuenta de personal</Text>

        <Text style={styles.fieldLabel}>Rol</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => {
            const active = form.role === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => cambiarRol(r.value)}
                style={[
                  styles.roleButton,
                  active && { backgroundColor: r.color, borderColor: r.color },
                ]}
                disabled={busy}
              >
                <Text
                  style={[styles.roleButtonText, active && styles.roleButtonTextActive]}
                >
                  {r.value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Nombre completo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Luis Quispe"
          placeholderTextColor={colors.placeholder}
          value={form.nombre}
          onChangeText={cambiar('nombre')}
          editable={!busy}
        />

        <Text style={styles.fieldLabel}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="luis.quispe@municipalidad.bo"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={form.email}
          onChangeText={cambiar('email')}
          editable={!busy}
        />

        <Text style={styles.fieldLabel}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={form.password}
          onChangeText={cambiar('password')}
          editable={!busy}
        />

        <Text style={styles.fieldLabel}>Código de acceso (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder={`Ej. ${prefijoActual}-0008 (se genera solo)`}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          value={form.codigo}
          onChangeText={cambiar('codigo')}
          editable={!busy}
        />
        <Text style={styles.hint}>
          Si lo dejas vacío se genera el siguiente libre del rol. La contraseña
          la eliges tú: entrégasela a la persona para que pueda entrar.
        </Text>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!exito && <Text style={styles.exito}>{exito}</Text>}

        <Pressable
          style={[styles.primaryButton, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Crear cuenta</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Cuentas creadas ({accounts.length})
        </Text>
        <Pressable onPress={cargar} disabled={loading}>
          <Text style={styles.link}>Actualizar</Text>
        </Pressable>
      </View>

      {loading && <Text style={styles.note}>Cargando personal…</Text>}
      {!!listError && <Text style={styles.error}>{listError}</Text>}

      {!loading && !listError && (
        <View>
          <RoleGroup
            titulo="Técnicos"
            items={tecnicos}
            vacio="Todavía no hay técnicos."
            color={colors.success}
          />
          <RoleGroup
            titulo="Administradores"
            items={administradores}
            vacio="Sin cuentas de este rol."
            color={colors.purple}
          />
        </View>
      )}
    </View>
  );
}

function RoleGroup({ titulo, items, vacio, color }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>
        {titulo} · {items.length}
      </Text>
      {!items.length && <Text style={styles.empty}>{vacio}</Text>}
      {items.map((a) => (
        <View key={a.id} style={styles.item}>
          <View style={[styles.itemBadge, { backgroundColor: `${color}1A` }]}>
            <Text style={[styles.itemBadgeText, { color }]}>
              {a.codigo ?? a.role.slice(0, 3)}
            </Text>
          </View>
          <View style={styles.itemMain}>
            <Text style={styles.itemName}>{a.nombre || a.email}</Text>
            <Text style={styles.itemMeta}>{a.email}</Text>
          </View>
          <Text style={[styles.itemRole, { color }]}>{a.role}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 30,
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
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#F7FAFB',
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleButtonText: {
    fontWeight: '800',
    fontSize: 13,
    color: colors.textFaint,
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    lineHeight: 16,
    marginTop: 8,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 12,
  },
  exito: {
    color: colors.success,
    fontSize: 12,
    marginTop: 12,
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
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  note: {
    color: colors.textFaint,
    marginBottom: 12,
  },
  group: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '900',
    color: colors.textFaint,
    marginBottom: 10,
  },
  empty: {
    fontSize: 12,
    color: colors.placeholder,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAF1F3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  itemMain: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  itemRole: {
    fontSize: 11,
    fontWeight: '800',
  },
});
