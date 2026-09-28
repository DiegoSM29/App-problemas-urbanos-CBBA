import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ReportsProvider } from './src/context/ReportsContext';
import { colors } from './src/theme/colors';
import ConnectionBanner from './src/components/ConnectionBanner';
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
        <ConnectionBanner />
        <View style={styles.body}>
          <Root />
        </View>
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.safe,
  },
  body: {
    flex: 1,
  },
});