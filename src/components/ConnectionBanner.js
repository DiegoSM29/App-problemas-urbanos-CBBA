import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useConnection } from '../hooks/useConnection';
import { recheck } from '../lib/connection';

const RESTORED_MS = 3000;

export default function ConnectionBanner() {
  const { online } = useConnection();
  const [restored, setRestored] = useState(false);
  const wasOnline = useRef(online);

  // Aviso breve al recuperar la conexión, para que el usuario sepa que ya
  // puede seguir. No se muestra al abrir la app (venía de estar en línea).
  useEffect(() => {
    const previous = wasOnline.current;
    wasOnline.current = online;
    if (!online) {
      setRestored(false);
      return;
    }
    if (!previous) setRestored(true);
  }, [online]);

  useEffect(() => {
    if (!restored) return undefined;
    const timer = setTimeout(() => setRestored(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [restored]);

  if (online && !restored) return null;

  return (
    <View style={[styles.banner, online ? styles.ok : styles.down]}>
      <Text style={styles.icon}>{online ? '✓' : '⚠'}</Text>
      <View style={styles.texts}>
        <Text style={styles.title}>
          {online ? 'Conexión restablecida' : 'Se perdió la conexión'}
        </Text>
        <Text style={styles.description}>
          {online
            ? 'Los datos se están actualizando.'
            : 'Revisa tu internet. Mientras tanto no podrás enviar ni cargar información.'}
        </Text>
      </View>
      {!online && (
        <Pressable style={styles.retry} onPress={recheck}>
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  down: {
    backgroundColor: '#FDECEA',
    borderBottomColor: '#F6C7C1',
  },
  ok: {
    backgroundColor: '#E6F6EE',
    borderBottomColor: '#BFE6D2',
  },
  icon: {
    fontSize: 18,
    fontWeight: '900',
  },
  texts: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 2,
  },
  retry: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.danger,
  },
});
