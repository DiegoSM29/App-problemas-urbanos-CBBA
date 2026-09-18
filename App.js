import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ReportsProvider } from './src/context/ReportsContext';
import { colors } from './src/theme/colors';
import OnboardingScreen from './src/screens/OnboardingScreen';
import MainApp from './src/screens/MainApp';

function Root() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <OnboardingScreen />;

  return (
    <ReportsProvider>
      <MainApp />
    </ReportsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safe}>
        <Root />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.safe,
  },
});