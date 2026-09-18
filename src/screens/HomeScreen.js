import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportsContext';
import CityMap from '../components/MapView';

function ActionCard({ icon, title, description, color, onPress }) {
  return (
    <Pressable
      style={[styles.actionCard, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </Pressable>
  );
}

function Impact({ icon, title, text }) {
  return (
    <View style={styles.impact}>
      <Text style={styles.impactIcon}>{icon}</Text>
      <View style={styles.impactText}>
        <Text style={styles.impactTitle}>{title}</Text>
        <Text style={styles.impactDesc}>{text}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ desktop, onNavigate }) {
  const { isAdmin, isTechnician } = useAuth();
  const { reports } = useReports();
  const [category, setCategory] = useState('Todos');

  const visible = reports
    .filter((r) => category === 'Todos' || r.category === category)
    .slice(0, 3);

  const quickCards = isAdmin
    ? [
        {
          icon: '▤',
          title: 'Todas las incidencias',
          description: 'Gestiona los reportes enviados',
          color: colors.purple,
          screen: 'Todos los reportes',
        },
        {
          icon: '✦',
          title: 'Ver mapa',
          description: 'Ubica las incidencias',
          color: colors.success,
          screen: 'Mapa',
        },
        {
          icon: 'i',
          title: 'Información',
          description: 'Conoce el proyecto',
          color: colors.accent,
          screen: 'Inicio',
        },
      ]
    : isTechnician
      ? [
          {
            icon: '▤',
            title: 'Mis asignaciones',
            description: 'Trabajos que te asignaron',
            color: colors.primary,
            screen: 'Mis asignaciones',
          },
          {
            icon: '✦',
            title: 'Ver mapa',
            description: 'Ubica las incidencias',
            color: colors.success,
            screen: 'Mapa',
          },
          {
            icon: 'i',
            title: 'Información',
            description: 'Conoce el proyecto',
            color: colors.purple,
            screen: 'Inicio',
          },
        ]
      : [
        {
          icon: '⚑',
          title: 'Reportar',
          description: 'Comunica un problema urbano',
          color: colors.accent,
          screen: 'Reportar',
        },
        {
          icon: '✦',
          title: 'Ver mapa',
          description: 'Ubica las incidencias',
          color: colors.success,
          screen: 'Mapa',
        },
        {
          icon: '▤',
          title: 'Mis reportes',
          description: 'Sigue cada avance',
          color: colors.warning,
          screen: 'Mis reportes',
        },
        {
          icon: 'i',
          title: 'Información',
          description: 'Conoce el proyecto',
          color: colors.purple,
          screen: 'Inicio',
        },
      ];

  return (
    <View style={styles.home}>
      <View style={[styles.hero, desktop && styles.heroDesktop]}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>
            {isAdmin
              ? 'PANEL MUNICIPAL'
              : isTechnician
                ? 'PANEL TÉCNICO'
                : 'CIUDADANÍA ACTIVA · COCHABAMBA'}
          </Text>
          <Text style={[styles.heroTitle, !desktop && styles.heroTitleMobile]}>
            {isAdmin
              ? 'Gestiona la ciudad.'
              : isTechnician
                ? 'Tus trabajos asignados.'
                : 'Hola, bienvenido de vuelta.'}
          </Text>
          <Text style={styles.heroDescription}>
            {isAdmin
              ? 'Revisa y actualiza el estado de todos los reportes enviados por la ciudadanía.'
              : isTechnician
                ? 'Atiende las incidencias que te asignaron y registra tu informe de trabajo.'
                : 'Mantente al tanto de las incidencias reportadas y su seguimiento.'}
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              onNavigate(
                isAdmin
                  ? 'Todos los reportes'
                  : isTechnician
                    ? 'Mis asignaciones'
                    : 'Reportar'
              )
            }
          >
            <Text style={styles.primaryButtonText}>
              {isAdmin
                ? 'Ver todos los reportes'
                : isTechnician
                  ? 'Ver mis asignaciones'
                  : 'Reportar una incidencia'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>CBBA</Text>
        </View>
      </View>

      <View style={[styles.quickActions, desktop && styles.quickActionsDesktop]}>
        {quickCards.map((c) => (
          <ActionCard
            key={c.title}
            icon={c.icon}
            title={c.title}
            description={c.description}
            color={c.color}
            onPress={() => onNavigate(c.screen)}
          />
        ))}
      </View>

      <View style={[styles.columns, desktop && styles.columnsDesktop]}>
        <View style={styles.recent}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>SEGUIMIENTO CIUDADANO</Text>
              <Text style={styles.sectionTitle}>Reportes recientes</Text>
            </View>
            <Pressable
              onPress={() =>
                onNavigate(
                  isAdmin
                    ? 'Todos los reportes'
                    : isTechnician
                      ? 'Mis asignaciones'
                      : 'Mis reportes'
                )
              }
            >
              <Text style={styles.sectionLink}>Ver todos →</Text>
            </Pressable>
          </View>
          {visible.map((r) => (
            <View style={styles.miniCard} key={r.id}>
              <View
                style={[
                  styles.miniThumb,
                  { backgroundColor: `${colors.primary}18` },
                ]}
              >
                <Text style={[styles.miniThumbIcon, { color: colors.primary }]}>
                  ●
                </Text>
              </View>
              <View style={styles.miniMain}>
                <Text style={styles.miniTitle}>{r.title}</Text>
                <Text style={styles.miniMeta}>
                  {r.place} · {r.status}
                </Text>
              </View>
              <Text style={styles.miniDate}>{r.time}</Text>
            </View>
          ))}
          {!visible.length && (
            <Text style={styles.empty}>Aún no hay reportes.</Text>
          )}
        </View>

        <View style={[styles.mapCol, desktop && styles.mapColDesktop]}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionEyebrow}>UBICACIÓN</Text>
              <Text style={styles.sectionTitle}>Mapa de incidencias</Text>
            </View>
            <Pressable onPress={() => onNavigate('Mapa')}>
              <Text style={styles.sectionLink}>Ver mapa →</Text>
            </Pressable>
          </View>
          <CityMap reports={reports} height={230} />
        </View>
      </View>

      <View style={[styles.impactRow, desktop && styles.impactRowDesktop]}>
        <Impact
          icon="✓"
          title="Aplicación multiplataforma"
          text="Disponible en web y dispositivos móviles."
        />
        <Impact
          icon="◎"
          title="Reportes geolocalizados"
          text="Cada incidencia queda ubicada en el mapa."
        />
        <Impact
          icon="⚑"
          title="Seguimiento de estados"
          text="Pendiente, en proceso o resuelto."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  home: {
    paddingTop: 18,
  },
  hero: {
    marginHorizontal: 16,
    minHeight: 250,
    borderRadius: 18,
    backgroundColor: colors.hero,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 26,
  },
  heroDesktop: {
    marginHorizontal: 38,
    minHeight: 280,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '900',
    color: colors.primaryDark,
    marginBottom: 13,
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    color: colors.text,
  },
  heroTitleMobile: {
    fontSize: 26,
    lineHeight: 30,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 12,
  },
  primaryButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  heroBadge: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(8, 121, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.primary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 20,
  },
  quickActionsDesktop: {
    marginHorizontal: 38,
  },
  actionCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 18,
  },
  actionIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
  },
  actionDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    lineHeight: 16,
  },
  columns: {
    flexDirection: 'column',
    gap: 28,
    marginHorizontal: 16,
    marginTop: 30,
  },
  columnsDesktop: {
    flexDirection: 'row',
    marginHorizontal: 38,
  },
  recent: {
    flex: 1.2,
  },
  mapCol: {
    flex: 1,
  },
  mapColDesktop: {
    marginTop: 0,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '900',
    color: colors.accent,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginTop: 3,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAF1F3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  miniThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniThumbIcon: {
    fontSize: 16,
  },
  miniMain: {
    flex: 1,
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  miniMeta: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  miniDate: {
    fontSize: 11,
    color: colors.placeholder,
  },
  empty: {
    color: colors.textFaint,
    paddingVertical: 14,
  },
  impactRow: {
    marginHorizontal: 16,
    marginTop: 30,
    gap: 16,
  },
  impactRowDesktop: {
    flexDirection: 'row',
    marginHorizontal: 38,
  },
  impact: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    backgroundColor: '#F7FAFB',
    borderRadius: 14,
    padding: 16,
  },
  impactIcon: {
    fontSize: 20,
    fontWeight: '900',
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
});