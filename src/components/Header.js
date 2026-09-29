import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import NotificationBell from './NotificationBell';

export default function Header({
  desktop,
  screen,
  menu,
  onNavigate,
  onAccount,
  onNotifications,
}) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.brandRow} onPress={() => onNavigate('Inicio')}>
        <View style={styles.brandLogo}>
          <Text style={styles.brandLogoText}>+</Text>
        </View>
        <View>
          <Text style={styles.brand}>
            COCHA<Text style={styles.brandGreen}>BAMBA</Text>
          </Text>
          <Text style={styles.brandTagline}>TE ESCUCHA</Text>
        </View>
      </Pressable>

      {desktop && (
        <View style={styles.headerNav}>
          {menu.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onNavigate(item.key)}
              style={styles.headerNavItem}
            >
              <Text
                style={[
                  styles.headerNavText,
                  screen === item.key && styles.headerNavActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {!!onNotifications && (
          <NotificationBell onPress={onNotifications} />
        )}
        <Pressable style={styles.loginButton} onPress={onAccount}>
          <Text style={styles.loginIcon}>◍</Text>
          <Text style={styles.loginButtonText}>Mi cuenta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 78,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F5',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandLogo: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.lightBlue,
  },
  brandLogoText: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.background,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.text,
  },
  brandGreen: {
    color: colors.secondary,
  },
  brandTagline: {
    fontSize: 8,
    letterSpacing: 2,
    fontWeight: '800',
    color: colors.primary,
  },
  headerNav: {
    flexDirection: 'row',
    gap: 30,
  },
  headerNavItem: {
    paddingVertical: 10,
  },
  headerNavText: {
    fontSize: 13,
    color: colors.textFaint,
  },
  headerNavActive: {
    fontWeight: '800',
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  loginIcon: {
    color: colors.accent,
    fontSize: 16,
  },
  loginButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '800',
  },
});