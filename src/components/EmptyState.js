import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

// Estado vacío con acción.
//
// Antes, cuando una lista llegaba vacía, la app solo escribía una línea
// de texto. Con un panel del administrador eso no distingue "no hay nada
// todavía" de "no tienes permiso para ver nada", que son fallos muy
// distintos y con causas opuestas. Este componente obliga a decir cuál
// de los dos es, y ofrece reintentar cuando puede ser un problema de
// conexión o de permisos.

export default function EmptyState({
  icon = '◇',
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
}) {
  const toneStyle =
    tone === 'error' ? styles.error : tone === 'ok' ? styles.ok : styles.neutral;

  return (
    <View style={[styles.box, toneStyle.box]}>
      <Text style={[styles.icon, toneStyle.icon]}>{icon}</Text>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!actionLabel && !!onAction && (
        <Pressable
          style={[styles.action, tone === 'error' && styles.actionError]}
          onPress={onAction}
        >
          <Text
            style={[
              styles.actionText,
              tone === 'error' && styles.actionTextError,
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  neutral: {
    box: {
      backgroundColor: '#F7FAFB',
      borderColor: '#EAF1F3',
    },
    icon: { color: colors.placeholder },
  },
  error: {
    box: {
      backgroundColor: '#FDECEA',
      borderColor: '#F6C7C1',
    },
    icon: { color: colors.danger },
  },
  ok: {
    box: {
      backgroundColor: '#E6F6EE',
      borderColor: '#BFE6D2',
    },
    icon: { color: colors.success },
  },
  icon: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  action: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  actionError: {
    borderColor: colors.danger,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  actionTextError: {
    color: colors.danger,
  },
});
