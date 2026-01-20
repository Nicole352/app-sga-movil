import React, { useState, useEffect, useRef } from 'react';
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
  id_curso: number;
  nombre: string;
  codigo_curso: string;
  aula_nombre: string;
  aula_ubicacion: string;
  hora_inicio: string;
  hora_fin: string;
  dias: string;
  docente_nombre: string;
}

export default function HorarioEstudiante() {
  const [darkMode, setDarkMode] = useState(false);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Day Selection Logic
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const diasAbrev = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  // Auto-select current day (0=Monday in our array logic, but JS Date 0=Sunday)
  const getCurrentDayIndex = () => {
    const day = new Date().getDay(); // 0=Sun, 1=Mon...
    // Convert to 0=Mon, 6=Sun
    return day === 0 ? 6 : day - 1;
  };

  const [selectedDayIndex, setSelectedDayIndex] = useState(getCurrentDayIndex());

  // Theme Config
  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#f59e0b',
      accentGradient: ['#f59e0b', '#d97706'] as const,
      activeTabBg: '#f59e0b',
      activeTabText: '#ffffff',
      inactiveTabBg: '#1a1a1a',
      inactiveTabText: '#71717a'
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b',
      accentGradient: ['#fbbf24', '#f59e0b'] as const,
      activeTabBg: '#fbbf24',
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
      const token = await getToken();
      const response = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const cursosConHorario = data
          .filter((curso: any) => curso.horario?.hora_inicio && curso.horario?.hora_fin && curso.horario?.dias)
          .map((curso: any) => ({
            id_curso: curso.id_curso,
            nombre: curso.nombre,
            codigo_curso: curso.codigo_curso,
            aula_nombre: curso.aula?.nombre || 'Sin aula asignada',
            aula_ubicacion: curso.aula?.ubicacion || '',
            hora_inicio: curso.horario.hora_inicio,
            hora_fin: curso.horario.hora_fin,
            dias: curso.horario.dias,
            docente_nombre: curso.docente?.nombre_completo || 'Sin docente asignado'
          }));
        setHorarios(cursosConHorario);
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

  // Gradient colors for cards to add variety but keep theme
  const cardGradients = [
    ['#fbbf24', '#f59e0b'] as const,
    ['#f59e0b', '#d97706'] as const,
    ['#fbbf24', '#d97706'] as const,
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Premium Header with Gradient */}
      {/* Premium Header - Clean Nike */}
      <View style={[styles.headerContainer, { marginBottom: 0 }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.cardBg,
              borderBottomColor: theme.border,
              borderBottomWidth: 1,
            }
          ]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Horario</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Calendario Semanal</Text>
            </View>
            <View style={[styles.headerIconContainer, { backgroundColor: theme.accent + '15' }]}>
              <Ionicons name="calendar" size={24} color={theme.accent} />
            </View>
          </View>
        </View>
      </View>

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
              No tienes ninguna clase programada para este día. ¡Disfruta tu tiempo libre!
            </Text>
          </Animated.View>
        ) : (
          currentClasses.map((clase, index) => {
            // Calculate duration in hours/minutes for visual scaling if desired, 
            // but fixed cards often look better on mobile.
            return (
              <Animated.View
                key={`${clase.id_curso}-${index}`}
                entering={FadeInDown.delay(index * 100).springify()}
                layout={Layout.springify()}
                style={styles.cardContainer}
              >
                {/* Time Column (Left Side) */}
                <View style={styles.timeColumn}>
                  <Text style={[styles.timeStart, { color: theme.text }]}>{clase.hora_inicio.substring(0, 5)}</Text>
                  <View style={[styles.timeLine, { backgroundColor: theme.border }]} />
                  <Text style={[styles.timeEnd, { color: theme.textSecondary }]}>{clase.hora_fin.substring(0, 5)}</Text>
                </View>

                {/* Card Content */}
                <LinearGradient
                  colors={darkMode ? ['rgba(245, 158, 11, 0.15)', 'rgba(217, 119, 6, 0.15)'] : ['#ffffff', '#fffbeb']}
                  style={[styles.classCard, { borderColor: theme.accent + '40' }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={[styles.accentStrip, { backgroundColor: theme.accent }]} />

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.courseCode, { color: theme.accent }]}>{clase.codigo_curso}</Text>
                      <View style={[styles.locationBadge, { backgroundColor: theme.accent + '20' }]}>
                        <Ionicons name="location" size={10} color={theme.accent} />
                        <Text style={[styles.locationText, { color: theme.accent }]}>{clase.aula_nombre}</Text>
                      </View>
                    </View>

                    <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={2}>
                      {clase.nombre}
                    </Text>

                    <View style={styles.teacherRow}>
                      <Ionicons name="person-circle-outline" size={16} color={theme.textSecondary} />
                      <Text style={[styles.teacherName, { color: theme.textSecondary }]} numberOfLines={1}>
                        {clase.docente_nombre}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
    zIndex: 10
  },
  header: {
    paddingTop: 10,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabsContainer: {
    paddingTop: 15,
    paddingBottom: 10,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },

  scrollContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  dayHeaderContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  dayHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayHeaderSubtitle: {
    fontSize: 14,
  },

  cardContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    height: 110,
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
    paddingVertical: 10,
    marginRight: 10,
  },
  timeStart: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    borderRadius: 1,
    opacity: 0.5,
  },
  timeEnd: {
    fontSize: 12,
    fontWeight: '500',
  },

  classCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accentStrip: {
    width: 4,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseCode: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  locationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teacherName: {
    fontSize: 12,
    fontWeight: '500',
  },

  emptyState: {
    padding: 30,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
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
    paddingHorizontal: 20,
  }
});
