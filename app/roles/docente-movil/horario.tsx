import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Horario {
  id_asignacion: number;
  curso_nombre: string;
  codigo_curso: string;
  aula_nombre: string;
  aula_ubicacion: string;
  hora_inicio: string;
  hora_fin: string;
  dias: string;
}

export default function HorarioDocente() {
  const [darkMode, setDarkMode] = useState(false);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Day Selection Logic
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const diasAbrev = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  // Auto-select current day
  const getCurrentDayIndex = () => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  };

  const [selectedDayIndex, setSelectedDayIndex] = useState(getCurrentDayIndex());

  // Theme Config - TEACHER BLUE
  const theme = darkMode
    ? {
      bg: '#0f172a',
      cardBg: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#3b82f6',
      accentGradient: ['#3b82f6', '#2563eb'] as const,
      activeTabBg: '#3b82f6',
      activeTabText: '#ffffff',
      inactiveTabBg: 'rgba(255,255,255,0.05)',
      inactiveTabText: '#94a3b8'
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#2563eb',
      accentGradient: ['#3b82f6', '#2563eb'] as const,
      activeTabBg: '#3b82f6',
      activeTabText: '#ffffff',
      inactiveTabBg: '#f1f5f9',
      inactiveTabText: '#64748b'
    };

  useEffect(() => {
    loadDarkMode();
    fetchHorario();
    eventEmitter.on('themeChanged', (isDark: boolean) => setDarkMode(isDark));
  }, []);

  const loadDarkMode = async () => {
    const savedMode = await storage.getItem('dark_mode');
    if (savedMode !== null) setDarkMode(savedMode === 'true');
  };

  const fetchHorario = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/mi-horario`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHorarios(data);
      }
    } catch (error) {
      console.error('Error fetching horario:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDayClasses = (dayIndex: number) => {
    const dayName = diasSemana[dayIndex];
    return horarios.filter(h => h.dias.split(',').map(d => d.trim()).includes(dayName))
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  };

  const currentClasses = getDayClasses(selectedDayIndex);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Premium Header with Blue Gradient */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <LinearGradient
          colors={theme.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Mi Horario</Text>
              <Text style={styles.headerSubtitle}>Calendario Semanal</Text>
            </View>
            <Ionicons name="calendar" size={28} color="#fff" />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Day Selector Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.bg }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {diasAbrev.map((dia, index) => {
            const isActive = selectedDayIndex === index;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedDayIndex(index)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? theme.activeTabBg : theme.inactiveTabBg,
                    borderColor: isActive ? 'transparent' : theme.border,
                    borderWidth: isActive ? 0 : 1
                  }
                ]}
              >
                <Text style={[
                  styles.tabText,
                  {
                    color: isActive ? theme.activeTabText : theme.inactiveTabText,
                    fontWeight: isActive ? '700' : '500'
                  }
                ]}>
                  {dia}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchHorario(); }}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.dayHeaderContainer}>
          <Text style={[styles.dayHeaderTitle, { color: theme.text }]}>
            {diasSemana[selectedDayIndex]}
          </Text>
          <Text style={[styles.dayHeaderSubtitle, { color: theme.textSecondary }]}>
            {currentClasses.length} {currentClasses.length === 1 ? 'clase' : 'clases'} programadas
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: theme.textSecondary }}>Cargando...</Text>
          </View>
        ) : currentClasses.length === 0 ? (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.emptyState, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          >
            <View style={[styles.emptyIconContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
              <Ionicons name="calendar-outline" size={48} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>Sin clases hoy</Text>
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
              No tienes ninguna clase programada para este día.
            </Text>
          </Animated.View>
        ) : (
          currentClasses.map((clase, index) => (
            <Animated.View
              key={`${clase.id_asignacion}-${index}`}
              entering={FadeInDown.delay(index * 100).springify()}
              layout={Layout.springify()}
              style={styles.cardContainer}
            >
              <View style={[styles.classCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {/* Blue Gradient Stripe */}
                <LinearGradient
                  colors={theme.accentGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardStripe}
                />

                <View style={styles.cardContent}>
                  {/* Time Badge */}
                  <View style={[styles.timeBadge, { backgroundColor: `${theme.accent}15` }]}>
                    <Ionicons name="time-outline" size={16} color={theme.accent} />
                    <Text style={[styles.timeText, { color: theme.accent }]}>
                      {clase.hora_inicio.substring(0, 5)} - {clase.hora_fin.substring(0, 5)}
                    </Text>
                  </View>

                  {/* Course Info */}
                  <View style={styles.courseInfo}>
                    <View style={[styles.codeBadge, { backgroundColor: `${theme.accent}15` }]}>
                      <Text style={[styles.codeText, { color: theme.accent }]}>{clase.codigo_curso}</Text>
                    </View>
                    <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                      {clase.curso_nombre}
                    </Text>
                  </View>

                  {/* Location */}
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                    <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                      {clase.aula_nombre}
                      {clase.aula_ubicacion ? ` • ${clase.aula_ubicacion}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  tabsContainer: {
    paddingVertical: 12,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  dayHeaderContainer: {
    marginBottom: 16,
  },
  dayHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayHeaderSubtitle: {
    fontSize: 13,
  },
  emptyState: {
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardContainer: {
    marginBottom: 12,
  },
  classCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardStripe: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 16,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  courseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  courseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
  },
});
