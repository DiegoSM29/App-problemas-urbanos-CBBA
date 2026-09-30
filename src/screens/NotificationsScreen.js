import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useNotifications } from '../context/NotificationsContext';
import EmptyState from '../components/EmptyState';

// Bandeja de notificaciones.
//
// Los avisos los escriben los triggers de la base de datos
// (supabase/notificaciones.sql). Aquí solo se listan y se marcan como
// leídos, que es lo único que RLS permite hacer desde el cliente.

function NotificationRow({ item, onPress }) {
  const unread = !item.leida;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, unread && styles.rowUnread]}
    >
      <View style={[styles.icon, { backgroundColor: `${colors[item.color] ?? colors.primary}18` }]}>
        <Text style={[styles.iconText, { color: colors[item.color] ?? colors.primary }]}>
          {item.icon}
        </Text>
      </View>

      <View style={styles.main}>
        <View style={styles.headRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {item.titulo}
          </Text>
          {unread && <View style={styles.dot} />}
        </View>

        <Text style={styles.body}>{item.cuerpo}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{item.label}</Text>
          <Text style={styles.metaTime}>{item.time}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen({ onOpenReport }) {
  const { items, loading, error, refresh, markRead, markAllRead, unread } =
    useNotifications();

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>AVISOS</Text>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.description}>
            {unread > 0
              ? `Tienes ${unread} aviso${unread === 1 ? '' : 's'} sin leer.`
              : 'Estás al día. Aquí aparecerán los avisos del municipio y de tus técnicos.'}
          </Text>
        </View>

        <View style={styles.headActions}>
          <Pressable
            style={styles.refreshButton}
            onPress={refresh}
            disabled={loading}
          >
            <Text style={styles.refreshText}>
              {loading ? '···' : '↻'}
            </Text>
          </Pressable>
          {unread > 0 && (
            <Pressable style={styles.readAll} onPress={markAllRead}>
              <Text style={styles.readAllText}>Leídas</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {!items.length && !loading && (
        <EmptyState
          icon="🔔"
          title="Sin notificaciones todavía"
          description="Aquí te avisaremos cuando llegue un reporte nuevo, cuando te asignen un trabajo y cuando resuelvan los que reportaste."
        />
      )}

      {items.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          onPress={() => {
            markRead(item.id);
            // Si el aviso viene de un reporte, se abre directamente en
            // él. Es lo que la gente espera al tocar un aviso.
            if (item.incidencia_id && onOpenReport) {
              onOpenReport(item.incidencia_id);
            }
          }}
        />
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
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headText: {
    flex: 1,
    paddingRight: 12,
  },
  headActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '900',
  },
  readAll: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAF1F3',
    borderRadius: 12,
    padding: 13,
    marginBottom: 9,
  },
  rowUnread: {
    backgroundColor: '#F1F8FC',
    borderColor: '#CBE4F3',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 15,
    fontWeight: '900',
  },
  main: {
    flex: 1,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  titleUnread: {
    fontWeight: '900',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  body: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: '900',
    color: colors.placeholder,
  },
  metaTime: {
    fontSize: 10,
    color: colors.placeholder,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 12,
  },
});
