import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNavigation from '../components/BottomNavigation';
import AccountModal from '../components/AccountModal';
import HomeScreen from './HomeScreen';
import ReportFormScreen from './ReportFormScreen';
import ReportsScreen from './ReportsScreen';
import TechnicianScreen from './TechnicianScreen';
import MapScreen from './MapScreen';

const reportKey = 'Mis reportes';

export default function MainApp() {
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const { isAdmin, isTechnician } = useAuth();

  const [screen, setScreen] = useState('Inicio');
  const [accountVisible, setAccountVisible] = useState(false);

  const menu = useMemo(() => {
    if (isAdmin) {
      return [
        { key: 'Inicio', label: 'Inicio' },
        { key: 'Todos los reportes', label: 'Todos los reportes' },
        { key: 'Mapa', label: 'Mapa' },
      ];
    }
    if (isTechnician) {
      return [
        { key: 'Inicio', label: 'Inicio' },
        { key: 'Mis asignaciones', label: 'Mis asignaciones' },
        { key: 'Mapa', label: 'Mapa' },
      ];
    }
    return [
      { key: 'Inicio', label: 'Inicio' },
      { key: 'Reportar', label: 'Reportar' },
      { key: reportKey, label: 'Mis reportes' },
      { key: 'Mapa', label: 'Mapa' },
    ];
  }, [isAdmin, isTechnician]);

  const showReports = screen === reportKey || screen === 'Todos los reportes';

  return (
    <View style={styles.app}>
      <Header
        desktop={desktop}
        screen={screen}
        menu={menu}
        onNavigate={setScreen}
        onAccount={() => setAccountVisible(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'Inicio' && (
          <HomeScreen desktop={desktop} onNavigate={setScreen} />
        )}
        {screen === 'Reportar' && !isAdmin && !isTechnician && (
          <ReportFormScreen onSubmit={setScreen} />
        )}
        {showReports && (
          <ReportsScreen
            admin={screen === 'Todos los reportes'}
            onNavigate={setScreen}
          />
        )}
        {screen === 'Mis asignaciones' && isTechnician && <TechnicianScreen />}
        {screen === 'Mapa' && <MapScreen desktop={desktop} />}
      </ScrollView>

      {!desktop && (
        <BottomNavigation
          screen={screen}
          onNavigate={setScreen}
          onAccount={() => setAccountVisible(true)}
          isAdmin={isAdmin}
          isTechnician={isTechnician}
        />
      )}

      <AccountModal
        visible={accountVisible}
        onClose={() => setAccountVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingBottom: 34,
  },
});