import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useNotifications } from '../context/NotificationsContext';

// Campana con el contador de avisos sin leer.
//
// El punto rojo es lo que hace que la bandeja exista de verdad: sin él,
// un usuario que no mira la pantalla de notificaciones se pierde los
// avisos para siempre. Por eso el badge se calcula desde la misma
// fuente que la lista y no se guarda en local.
export default function NotificationBell({ onPress }) {
  const { unread, newest, dismissNewest } = useNotifications();
  const [pulse, setPulse] = useState(false);

  // Un parpadeo corto al llegar un aviso nuevo, para que se note aunque
  // la persona esté mirando otra pantalla.
  useEffect(() => {
    if (!newest) return undefined;

    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 1600);
    return () => clearTimeout(timer);
  }, [newest]);

  // El aviso nuevo se apaga solo a los pocos segundos, para no dejar una
  // alerta permanente encima de la cabecera.
  useEffect(() => {
    if (!newest) return undefined;
    const timer = setTimeout(dismissNewest, 6000);
    return () => clearTimeout(timer);
  }, [newest, dismissNewest]);

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={[styles.button, pulse && styles.buttonPulse]}
        accessibilityLabel={`Notificaciones${unread ? `: ${unread} sin leer` : ''}`}
      >
        <Text style={styles.icon}>🔔</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>

      {!!newest && (
        <View style={styles.toast}>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {newest.titulo}
          </Text>
          <Text style={styles.toastBody} numberOfLines={2}>
            {newest.cuerpo}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  buttonPulse: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.primary,
  },
  icon: {
    fontSize: 17,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 260,
    backgroundColor: colors.text,
    borderRadius: 12,
    padding: 13,
    zIndex: 50,
  },
  toastTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  toastBody: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 4,
  },
});
