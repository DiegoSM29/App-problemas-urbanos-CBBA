import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../theme/colors';
import CityIllustration from '../components/CityIllustration';
import LoginModal from '../components/LoginModal';

function Impact({ icon, title, text }) {
  return (
    <View style={styles.impact}>
      <View style={styles.impactIconWrap}>
        <Text style={styles.impactIcon}>{icon}</Text>
      </View>
      <View style={styles.impactText}>
        <Text style={styles.impactTitle}>{title}</Text>
        <Text style={styles.impactDesc}>{text}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const [modalVisible, setModalVisible] = useState(false);
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('Ciudadano');

  const openLogin = () => {
    setRole('Ciudadano');
    setMode('login');
    setModalVisible(true);
  };
  const openRegister = () => {
    setRole('Ciudadano');
    setMode('register');
    setModalVisible(true);
  };
  const openTechnician = () => {
    setRole('Técnico');
    setMode('login');
    setModalVisible(true);
  };

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Pressable style={styles.brandLogoWrap}>
            <Text style={styles.brandLogo}>+</Text>
          </Pressable>
          <View>
            <Text style={styles.brand}>
              COCHA<Text style={styles.brandGreen}>BAMBA</Text>
            </Text>
            <Text style={styles.brandTagline}>TE ESCUCHA</Text>
          </View>
        </View>

        <View style={[styles.hero, desktop && styles.heroDesktop]}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>CIUDADANÍA ACTIVA · COCHABAMBA</Text>
            <Text style={[styles.heroTitle, !desktop && styles.heroTitleMobile]}>
              Cochabamba,{'\n'}te escucha.
            </Text>
            <Text style={styles.heroDescription}>
              Reporta, participa y construyamos una mejor ciudad. Tu voz
              conecta con quienes pueden generar el cambio.
            </Text>
            <View style={[styles.authRow, !desktop && styles.authRowMobile]}>
              <Pressable style={styles.primaryButton} onPress={openLogin}>
                <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={openRegister}>
                <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
              </Pressable>
            </View>
            <Pressable onPress={openTechnician} style={styles.techLink}>
              <Text style={styles.techLinkText}>
                ¿Eres técnico municipal? Ingresa aquí
              </Text>
            </Pressable>
          </View>
          <CityIllustration />
        </View>

        <View style={[styles.impacts, desktop && styles.impactsDesktop]}>
          <Impact
            icon="✓"
            title="Aplicación multiplataforma"
            text="Disponible en web y dispositivos móviles."
          />
          <Impact
            icon="◎"
            title="Reportes geolocalizados"
            text="Ubica cada incidencia en el mapa de Cochabamba."
          />
          <Impact
            icon="⚑"
            title="Seguimiento de estados"
            text="Pendiente, en proceso o resuelto, siempre visible."
          />
        </View>

        <Text style={styles.footer}>
          Plataforma municipal de reporte de incidencias urbanas
        </Text>
      </ScrollView>

      <LoginModal
        visible={modalVisible}
        mode={mode}
        initialRole={role}
        onClose={() => setModalVisible(false)}
        onSwitchMode={() => setMode(mode === 'register' ? 'login' : 'register')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 18,
  },
  brandLogoWrap: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.lightBlue,
  },
  brandLogo: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
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
  hero: {
    marginHorizontal: 16,
    minHeight: 330,
    borderRadius: 18,
    backgroundColor: colors.hero,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  heroDesktop: {
    marginHorizontal: 38,
    minHeight: 380,
  },
  heroText: {
    width: '60%',
    padding: 30,
    paddingTop: 42,
    zIndex: 2,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.primaryDark,
    marginBottom: 13,
  },
  heroTitle: {
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '900',
    color: colors.text,
  },
  heroTitleMobile: {
    fontSize: 34,
    lineHeight: 37,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 15,
  },
  authRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  authRowMobile: {
    flexDirection: 'column',
  },
  techLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  techLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  impacts: {
    paddingHorizontal: 26,
    paddingTop: 26,
    gap: 16,
  },
  impactsDesktop: {
    flexDirection: 'row',
  },
  impact: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  impactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  impactText: {
    flex: 1,
  },
  impactTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  impactDesc: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 3,
    lineHeight: 17,
  },
  footer: {
    textAlign: 'center',
    marginTop: 34,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.placeholder,
  },
});