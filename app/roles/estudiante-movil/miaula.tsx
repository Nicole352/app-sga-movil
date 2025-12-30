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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { storage, getToken, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

// Helper para calcular la próxima clase (lógica mejorada)
const getProximaClase = (horario: any) => {
  if (!horario?.dias || !horario?.hora_inicio) return null;

  const diasMap: { [key: string]: number } = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
  };

  const diasClase = horario.dias.split(',').map((d: string) => d.trim());
  const hoy = new Date();
  const diaHoy = hoy.getDay();
  const horaActual = hoy.getHours() * 60 + hoy.getMinutes();

  const [horaInicioH, horaInicioM] = horario.hora_inicio.split(':').map(Number);
  const minutosInicio = horaInicioH * 60 + horaInicioM;

  let proximoDia = -1;
  let diasHastaClase = -1;

  const diasIndices = diasClase.map((d: string) => diasMap[d]).sort((a: number, b: number) => a - b);

  // 1. Buscar hoy si aún no ha pasado la hora
  if (diasIndices.includes(diaHoy) && minutosInicio > horaActual) {
    proximoDia = diaHoy;
    diasHastaClase = 0;
  } else {
    // 2. Buscar días restantes de la semana
    const diasFuturos = diasIndices.filter((d: number) => d > diaHoy);
    if (diasFuturos.length > 0) {
      proximoDia = diasFuturos[0];
      diasHastaClase = proximoDia - diaHoy;
    } else {
      // 3. Buscar en la próxima semana
      proximoDia = diasIndices[0];
      diasHastaClase = 7 - diaHoy + proximoDia;
    }
  }

  const fechaProxima = new Date(hoy);
  fechaProxima.setDate(hoy.getDate() + diasHastaClase);
  fechaProxima.setHours(horaInicioH, horaInicioM, 0, 0);

  return fechaProxima;
};

const { width } = Dimensions.get('window');

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  progreso: number;
  calificacion: number;
  tareasPendientes: number;
  docente?: {
    nombre_completo: string;
    titulo: string;
  };
  aula?: {
    nombre: string;
    ubicacion: string;
  };
  horario?: {
    hora_inicio: string;
    hora_fin: string;
    dias: string;
  };
}

export default function MiAulaEstudiante() {
  const [darkMode, setDarkMode] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const fetchCursos = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCursos(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const socketEvents = {
    'nueva_tarea': () => fetchCursos(),
    'nuevo_modulo': () => fetchCursos(),
    'tarea_calificada': () => fetchCursos(),
    'progreso_actualizado': () => fetchCursos(),
    'tarea_entregada': () => fetchCursos()
  };

  useSocket(socketEvents, userData?.id_usuario);

  const theme = darkMode
    ? {
      bg: '#0f172a', // Slate 900
      cardBg: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#fbbf24', // Amber 400
      primaryGradient: ['#f59e0b', '#d97706'] as const,
      danger: '#ef4444',
      success: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6'
    }
    : {
      bg: '#f8fafc', // Slate 50
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b', // Amber 500
      primaryGradient: ['#fbbf24', '#f59e0b'] as const,
      danger: '#dc2626',
      success: '#059669',
      blue: '#2563eb',
      purple: '#7c3aed'
    };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) setDarkMode(savedMode === 'true');
      const user = await getUserData();
      if (isMounted) setUserData(user);
      await fetchCursos();
      if (isMounted) setLoading(false);
    };

    loadData();

    const handleThemeChange = (value: boolean) => setDarkMode(value);
    eventEmitter.on('themeChanged', handleThemeChange);
    return () => {
      isMounted = false;
      eventEmitter.off('themeChanged', handleThemeChange);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCursos();
  };

  const proximasClases = useMemo(() => {
    return cursos
      .filter(c => c.horario && c.horario.dias)
      .map(c => ({ ...c, nextDate: getProximaClase(c.horario) }))
      .filter(c => c.nextDate !== null)
      .sort((a, b) => (a.nextDate?.getTime() || 0) - (b.nextDate?.getTime() || 0))
      .slice(0, 5); // Tantas como quieras mostrar
  }, [cursos]);

  const promedioGeneral = cursos.length > 0 ? Math.round(cursos.reduce((acc, c) => acc + (Number(c.progreso) || 0), 0) / cursos.length) : 0;
  const promedioCalificaciones = cursos.length > 0 && cursos.some(c => c.calificacion)
    ? (cursos.reduce((acc, c) => acc + (Number(c.calificacion) || 0), 0) / cursos.length).toFixed(1) : '0.0';
  const totalTareasPendientes = cursos.reduce((acc, c) => acc + (Number(c.tareasPendientes) || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Gradient */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <LinearGradient
            colors={darkMode ? ['#b45309', '#78350f'] : ['#fbbf24', '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.greetingText}>Hola,</Text>
                  <Text style={styles.nameText}>
                    {userData?.nombres || userData?.nombre || 'Estudiante'} {userData?.apellido || ''}
                  </Text>
                </View>
                {/* Profile button removed as it exists in the main header */}
              </View>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View style={styles.statsContainer} entering={FadeInDown.delay(200).duration(600)}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIconBadge, { backgroundColor: `${theme.accent}20` }]}>
              <Ionicons name="trending-up" size={18} color={theme.accent} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Progreso</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{promedioGeneral}%</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIconBadge, { backgroundColor: `${theme.blue}20` }]}>
              <Ionicons name="book" size={18} color={theme.blue} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cursos</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{cursos.length}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIconBadge, { backgroundColor: `${theme.success}20` }]}>
              <Ionicons name="star" size={18} color={theme.success} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Promedio</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{promedioCalificaciones}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIconBadge, { backgroundColor: `${theme.purple}20` }]}>
              <Ionicons name="clipboard" size={18} color={theme.purple} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tareas</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{totalTareasPendientes}</Text>
          </View>
        </Animated.View>

        {/* Proximas Clases Section */}
        {proximasClases.length > 0 && (
          <Animated.View entering={FadeInRight.delay(300).duration(600)} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Próximas Clases</Text>
              <TouchableOpacity>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Ver horario</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {proximasClases.map((curso, index) => (
                <TouchableOpacity
                  key={`next-${curso.id_curso}-${index}`}
                  style={[styles.nextClassCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                >
                  <LinearGradient
                    colors={index === 0 ? theme.primaryGradient : [theme.cardBg, theme.cardBg]}
                    style={styles.nextClassIndicator}
                  />
                  <View style={styles.nextClassContent}>
                    <Text style={[styles.nextClassTime, { color: theme.accent }]}>
                      {curso.horario?.hora_inicio?.substring(0, 5)}
                    </Text>
                    <Text style={[styles.nextClassName, { color: theme.text }]} numberOfLines={1}>
                      {curso.nombre}
                    </Text>
                    <View style={styles.nextClassMeta}>
                      <Ionicons name="calendar-outline" size={12} color={theme.textMuted} />
                      <Text style={[styles.nextClassDate, { color: theme.textMuted }]}>
                        {curso.nextDate?.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                      </Text>
                      {curso.aula && (
                        <>
                          <Text style={{ color: theme.textMuted }}>•</Text>
                          <Text style={{ color: theme.textMuted, fontSize: 11 }}>{curso.aula.nombre}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* My Courses Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginHorizontal: 16, marginBottom: 12 }]}>Mis Cursos</Text>
          <View style={{ gap: 16, paddingHorizontal: 16 }}>
            {cursos.map((curso, index) => (
              <Animated.View key={`curso-${curso.id_curso}-${index}`} entering={FadeInDown.delay(400 + (index * 100)).duration(500)}>
                <TouchableOpacity
                  style={[styles.courseCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                >
                  {/* Course Header with partial gradient */}
                  <View style={styles.courseHeader}>
                    <LinearGradient
                      colors={[`${theme.accent}15`, 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <View style={styles.courseHeaderContent}>
                      <View style={[styles.courseBadge, { backgroundColor: theme.accent }]}>
                        <Text style={styles.courseBadgeText}>{curso.codigo_curso}</Text>
                      </View>
                      <View style={styles.courseRating}>
                        <Ionicons name="star" size={14} color={theme.accent} />
                        <Text style={[styles.courseRatingText, { color: theme.text }]}>
                          {Number(curso.calificacion || 0).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.courseBody}>
                    <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={2}>
                      {curso.nombre}
                    </Text>

                    {curso.docente && (
                      <View style={styles.teacherRow}>
                        <Ionicons name="school-outline" size={14} color={theme.textMuted} />
                        <Text style={[styles.teacherName, { color: theme.textSecondary }]}>
                          {curso.docente.nombre_completo}
                        </Text>
                      </View>
                    )}

                    <View style={styles.progressContainer}>
                      <View style={styles.progressLabels}>
                        <Text style={[styles.progressLabel, { color: theme.textMuted }]}>Avance</Text>
                        <Text style={[styles.progressValue, { color: theme.text }]}>{Math.round(curso.progreso || 0)}%</Text>
                      </View>
                      <View style={[styles.progressBarBg, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }]}>
                        <View style={[styles.progressBarFill, { width: `${curso.progreso || 0}%`, backgroundColor: theme.accent }]} />
                      </View>
                    </View>

                    <View style={[styles.courseFooter, { borderTopColor: theme.border }]}>
                      <View style={styles.taskStatus}>
                        {curso.tareasPendientes > 0 ? (
                          <>
                            <Ionicons name="alert-circle" size={16} color={theme.danger} />
                            <Text style={[styles.taskStatusText, { color: theme.danger }]}>
                              {curso.tareasPendientes} pendiente{curso.tareasPendientes !== 1 ? 's' : ''}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                            <Text style={[styles.taskStatusText, { color: theme.success }]}>Al día</Text>
                          </>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.continueButton, { backgroundColor: `${theme.accent}15` }]}
                        onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                      >
                        <Text style={[styles.continueButtonText, { color: theme.accent }]}>
                          {curso.tareasPendientes > 0 ? 'Subir Tarea' : 'Continuar'}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={theme.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {},
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greetingText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  nameText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -25, // Overlap header
    gap: 10,
  },
  statCard: {
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
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionContainer: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  nextClassCard: {
    width: width * 0.5,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  nextClassIndicator: {
    width: 6,
    height: '100%',
  },
  nextClassContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'center',
  },
  nextClassTime: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  nextClassName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  nextClassMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextClassDate: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  courseCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseHeader: {
    height: 40,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  courseHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  courseBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  courseRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseRatingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  courseBody: {
    padding: 16,
    paddingTop: 12,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  teacherName: {
    fontSize: 12,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  taskStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  continueButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
