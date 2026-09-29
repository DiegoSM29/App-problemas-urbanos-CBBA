import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import BottomNavigation from '../components/BottomNavigation';
import AccountModal from '../components/AccountModal';
import AboutModal from '../components/AboutModal';
import HomeScreen from './HomeScreen';
import ReportFormScreen from './ReportFormScreen';
import ReportsScreen from './ReportsScreen';
import TechnicianScreen from './TechnicianScreen';
import NotificationsScreen from './NotificationsScreen';
import UsersScreen from './UsersScreen';
import MapScreen from './MapScreen';

const reportKey = 'Mis reportes';
const notificationsKey = 'Notificaciones';
const staffKey = 'Personal';

export default function MainApp() {
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const { isAdmin, isTechnician } = useAuth();

  const [screen, setScreen] = useState('Inicio');
  const [accountVisible, setAccountVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);

  const menu = useMemo(() => {
    if (isAdmin) {
      return [
        { key: 'Inicio', label: 'Inicio' },
        { key: 'Todos los reportes', label: 'Todos los reportes' },
        { key: staffKey, label: 'Personal' },
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

  // Al abrir un reporte desde un aviso, se salta a la lista que le
  // corresponde según el rol. Si el reporte ya no está visible para esa
  // persona (por ejemplo, es de otro ciudadano), la lista simplemente
  // mostrará su estado vacío en vez de romper nada.
  const reportListFor = useCallback(() => {
    if (isAdmin) return 'Todos los reportes';
    if (isTechnician) return 'Mis asignaciones';
    return reportKey;
  }, [isAdmin, isTechnician]);

  const openReport = useCallback(() => {
    setScreen(reportListFor());
  }, [reportListFor]);

  const openNotifications = useCallback(() => {
    setScreen(notificationsKey);
  }, []);

  return (
    <View style={styles.app}>
      <Header
        desktop={desktop}
        screen={screen}
        menu={menu}
        onNavigate={setScreen}
        onAccount={() => setAccountVisible(true)}
        onNotifications={openNotifications}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {screen === 'Inicio' && (
          <HomeScreen
            desktop={desktop}
            onNavigate={setScreen}
            onInfo={() => setAboutVisible(true)}
          />
        )}
        {screen === 'Reportar' && !isAdmin && !isTechnician && (
          <ReportFormScreen onSubmit={setScreen} />
        )}
        {showReports && (
          <ReportsScreen admin={screen === 'Todos los reportes'} />
        )}
        {screen === 'Mis asignaciones' && isTechnician && <TechnicianScreen />}
        {screen === notificationsKey && (
          <NotificationsScreen onOpenReport={openReport} />
        )}
        {screen === staffKey && isAdmin && <UsersScreen />}
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

      <AboutModal
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
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
