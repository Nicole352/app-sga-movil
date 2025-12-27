import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { storage, getToken, getUserData, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

const { width } = Dimensions.get('window');

interface CursoResumen {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  total_estudiantes: number;
  capacidad_maxima: number;
  fecha_inicio: string;
  fecha_fin: string;
  aula_nombre?: string;
  aula_ubicacion?: string;
  estado?: 'activo' | 'finalizado' | 'planificado' | 'cancelado';
  hora_inicio?: string;
  dias?: string;
}

export default function DocenteDashboard() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [cursos, setCursos] = useState<CursoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const theme = darkMode
    ? {
      bg: '#0f172a',
      cardBg: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#3b82f6',
      primaryGradient: ['#3b82f6', '#2563eb'] as const,
      success: '#10b981',
      warning: '#f59e0b',
      purple: '#8b5cf6',
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#2563eb',
      primaryGradient: ['#3b82f6', '#2563eb'] as const,
      success: '#059669',
      warning: '#d97706',
      purple: '#7c3aed',
    };

  useEffect(() => {
    loadData();
    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    const profileHandler = async () => {
      const user = await getUserData();
      setUserData(user);
    };
    eventEmitter.on('themeChanged', themeHandler);
    eventEmitter.on('profilePhotoUpdated', profileHandler);
    return () => {
      eventEmitter.off('themeChanged', themeHandler);
      eventEmitter.off('profilePhotoUpdated', profileHandler);
    };
  }, []);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      const user = await getUserData();
      setUserData(user);
      await fetchCursos();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  useSocket({
    'curso_asignado': () => fetchCursos(),
    'nueva_matricula_curso': () => fetchCursos(),
    'estudiante_matriculado': () => fetchCursos(),
    'tarea_entregada_docente': () => fetchCursos(),
    'tareas_por_calificar': () => fetchCursos(),
    'nueva_entrega': () => fetchCursos(),
  }, userData?.id_usuario);

  const fetchCursos = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/mis-cursos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCursos(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCursos();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const totalEstudiantes = cursos.reduce((acc, curso) => acc + curso.total_estudiantes, 0);
  const capacidadTotal = cursos.reduce((acc, curso) => acc + curso.capacidad_maxima, 0);
  const promedioOcupacion = capacidadTotal > 0 ? Math.round((totalEstudiantes / capacidadTotal) * 100) : 0;
  const cursosActivos = cursos.filter(c => (c.estado || 'activo') === 'activo').length;

  const renderStatsCard = (
    title: string,
    value: string | number,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    delay: number
  ) => (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500)}
      style={[styles.statCardContainer, {
        backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
        borderColor: theme.border
      }]}
    >
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{title}</Text>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* PREMIUM HEADER - BLUE GRADIENT (Teacher Identity) */}
        <View style={styles.headerContainer}>
          <LinearGradient
            colors={theme.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.welcomeText}>Bienvenido,</Text>
                  <Text style={styles.userName}>
                    {userData?.nombre} {userData?.apellido}
                  </Text>
                  <Text style={styles.userRole}>
                    {userData?.titulo_profesional || 'Docente'}
                  </Text>
                </View>
                {/* Profile Icon REMOVED as requested */}
              </View>

              {/* Date Badge */}
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* STATS ROW - 4 CARDS (Like miaula.tsx) */}
        <View style={styles.statsGrid}>
          {renderStatsCard('Activos', cursosActivos, 'book', theme.accent, 100)}
          {renderStatsCard('Alumnos', totalEstudiantes, 'people', theme.success, 200)}
          {renderStatsCard('Ocupación', `${promedioOcupacion}%`, 'stats-chart', theme.warning, 300)}
          {renderStatsCard('Capacidad', capacidadTotal, 'easel', theme.purple, 400)}
        </View>

        {/* QUICK ACCESS */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Acceso Rápido</Text>
        </View>

        <View style={styles.quickAccessContainer}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/roles/docente-movil/calificaciones' as any)}
          >
            <View style={[styles.quickBtnIcon, { backgroundColor: `${theme.accent}15` }]}>
              <Ionicons name="trending-up" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.quickBtnText, { color: theme.text }]} numberOfLines={1}>Calificaciones</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/roles/docente-movil/horario' as any)}
          >
            <View style={[styles.quickBtnIcon, { backgroundColor: `${theme.warning}15` }]}>
              <Ionicons name="calendar" size={20} color={theme.warning} />
            </View>
            <Text style={[styles.quickBtnText, { color: theme.text }]} numberOfLines={1}>Horario</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/roles/docente-movil/estudiantes' as any)}
          >
            <View style={[styles.quickBtnIcon, { backgroundColor: `${theme.success}15` }]}>
              <Ionicons name="people" size={20} color={theme.success} />
            </View>
            <Text style={[styles.quickBtnText, { color: theme.text }]} numberOfLines={1}>Estudiantes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/roles/docente-movil/tomarasistencia' as any)}
          >
            <View style={[styles.quickBtnIcon, { backgroundColor: `${theme.primaryGradient[0]}15` }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.primaryGradient[0]} />
            </View>
            <Text style={[styles.quickBtnText, { color: theme.text }]} numberOfLines={1}>Asistencia</Text>
          </TouchableOpacity>
        </View>

        {/* COURSE LIST */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Mis Cursos</Text>
          <View style={[styles.badge, { backgroundColor: `${theme.accent}15` }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>{cursos.length}</Text>
          </View>
        </View>

        <View style={styles.coursesContainer}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary }}>Cargando cursos...</Text>
            </View>
          ) : cursos.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons name="library-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No tienes cursos asignados</Text>
            </View>
          ) : (
            cursos.map((curso, index) => (
              <Animated.View
                key={curso.id_curso}
                entering={FadeInDown.delay(index * 100).springify()}
              >
                <TouchableOpacity
                  style={[styles.courseCard, {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    shadowColor: theme.text
                  }]}
                  onPress={() => router.push(`/roles/docente-movil/detallecursodocente?id=${curso.id_curso}` as any)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={theme.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cardStripe}
                  />

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.codeBadge, { backgroundColor: `${theme.accent}15` }]}>
                        <Text style={[styles.codeText, { color: theme.accent }]}>{curso.codigo_curso}</Text>
                      </View>
                      <Text style={[styles.dateText, { color: theme.textMuted }]}>
                        Inicio: {formatDate(curso.fecha_inicio)}
                      </Text>
                    </View>

                    <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={2}>
                      {curso.nombre}
                    </Text>

                    {curso.aula_nombre && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                        <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                          {curso.aula_nombre} {curso.aula_ubicacion ? `• ${curso.aula_ubicacion}` : ''}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.divider, { backgroundColor: theme.border }]} />

                    <View style={styles.cardFooter}>
                      <View style={styles.footerItem}>
                        <Ionicons name="people-outline" size={16} color={theme.accent} />
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                          <Text style={{ fontWeight: '700', color: theme.text }}>{curso.total_estudiantes}</Text> inscritos
                        </Text>
                      </View>

                      <View style={styles.footerItem}>
                        <View style={[styles.progressBarBG, { backgroundColor: `${theme.accent}20` }]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                backgroundColor: theme.accent,
                                width: `${Math.min((curso.total_estudiantes / curso.capacidad_maxima) * 100, 100)}%`
                              }
                            ]}
                          />
                        </View>
                        <Text style={[styles.footerSub, { color: theme.textMuted }]}>
                          {Math.round((curso.total_estudiantes / curso.capacidad_maxima) * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header matched to miaula.tsx
  headerContainer: {
    marginBottom: 20, // Keep this as container margin
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {}, // Removed gap: 16 to match structure better or keep if content needs it. 
  // keeping structure similar but styles exact
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeText: { // greetingText in miaula
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  userName: { // nameText in miaula
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  userRole: { // Extra in teacher
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontWeight: '500',
  },
  dateBadge: { // dateContainer in miaula
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    // Removed background/radius to match "dateContainer" style which is just text row? 
    // Wait, miaula.tsx has dateContainer with dateText. 
    // Teacher had a badge. User wants "visual consistency". 
    // Miaula: dateText color rgba(white, 0.9) size 12.
    // Let's make it look like simple text if that is what miaula does.
    // actually miaula dateContainer is simple row.
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textTransform: 'capitalize',
  },

  // Stats ROW exact match to miaula.tsx
  statsGrid: { // statsContainer
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -25, // Overlap header
    gap: 10,
    zIndex: 10,
  },
  statCardContainer: { // statCard
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: { // statIconBadge
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: { // statLabel
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: { // statValue
    fontSize: 14,
    fontWeight: '700',
  },

  // Titles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Quick Access
  quickAccessContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  quickBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Courses
  coursesContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  courseCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardStripe: {
    height: 6,
    width: '100%',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // dateText reused from global? No, scoped. keeping specific one
  // course date text
  courseDateText: { // Renamed to avoid collision or just keep logic
    fontSize: 11,
    fontWeight: '500',
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
  },
  footerSub: {
    fontSize: 10,
    marginLeft: 6,
    marginTop: 1,
  },
  progressBarBG: {
    width: 60,
    height: 6,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
});
