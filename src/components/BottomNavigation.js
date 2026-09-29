import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function BottomNavigation({
  screen,
  onNavigate,
  onAccount,
  isAdmin,
  isTechnician,
}) {
  const reportKey = isAdmin
    ? 'Todos los reportes'
    : isTechnician
      ? 'Mis asignaciones'
      : 'Mis reportes';
  const reportShort = isTechnician ? 'Asignados' : 'Reportes';
  const showReportar = !isAdmin && !isTechnician;

  const items = [
    { icon: '⌂', key: 'Inicio', short: 'Inicio' },
    { icon: '✦', key: 'Mapa', short: 'Mapa' },
    ...(showReportar
      ? [{ icon: '+', key: 'Reportar', short: 'Reportar', float: true }]
      : []),
    { icon: '▤', key: reportKey, short: reportShort },
    { icon: '◍', key: 'Ajustes', short: 'Perfil', account: true },
  ];

  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = screen === item.key;
        return (
          <Pressable
            key={item.short}
            style={styles.item}
            onPress={() => (item.account ? onAccount() : onNavigate(item.key))}
          >
            <View
              style={[
                styles.iconWrap,
                item.float && styles.iconFloat,
                active && styles.iconActiveWrap,
              ]}
            >
              <Text
                style={[
                  styles.icon,
                  item.float && styles.iconFloatText,
                  active && !item.float && styles.iconActive,
                ]}
              >
                {item.icon}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {item.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F4',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  icon: {
    fontSize: 20,
    color: '#5B7079',
  },
  iconFloat: {
    backgroundColor: colors.primary,
    height: 34,
    borderRadius: 17,
    marginTop: -14,
  },
  iconFloatText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  iconActiveWrap: {
    backgroundColor: '#EAF3F7',
  },
  iconActive: {
    color: colors.primary,
    fontWeight: '900',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5B7079',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
});