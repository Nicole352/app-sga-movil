import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo_curso: string;
  progreso: number;
  calificacion: number;
  tareasPendientes: number;
  estado_matricula: string;
  fecha_matricula: string;
  docente: {
    nombre_completo: string | null;
    titulo: string | null;
  };
  aula: {
    nombre: string | null;
    ubicacion: string | null;
  };
  horario: {
    hora_inicio: string | null;
    hora_fin: string | null;
    dias: string | null;
  };
}

export default function HistorialAcademico() {
  const [darkMode, setDarkMode] = useState(false);
  const [cursosActivos, setCursosActivos] = useState<Curso[]>([]);
  const [cursosFinalizados, setCursosFinalizados] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vistaActual, setVistaActual] = useState<'activos' | 'finalizados'>('activos');

  const theme = darkMode ? {
    bg: '#0f172a',
    cardBg: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: '#334155',
    accent: '#fbbf24',
    success: '#10b981',
    warning: '#f59e0b',
    cardGradientStart: 'rgba(30, 41, 59, 0.8)',
    cardGradientEnd: 'rgba(30, 41, 59, 1)',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    border: '#e2e8f0',
    accent: '#f59e0b',
    success: '#059669',
    warning: '#d97706',
    cardGradientStart: '#ffffff',
    cardGradientEnd: '#f8fafc',
  };

  useEffect(() => {
    loadDarkMode();
    fetchHistorial();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  const loadDarkMode = async () => {
    const savedMode = await storage.getItem('dark_mode');
    if (savedMode !== null) {
      setDarkMode(savedMode === 'true');
    }
  };

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      const response = await fetch(`${API_URL}/estudiantes/historial-academico`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCursosActivos(data.activos || []);
        setCursosFinalizados(data.finalizados || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistorial();
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calcularDuracion = (fechaInicio: string, fechaFin: string) => {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const meses = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  };

  const getGradientColors = (index: number) => {
    const gradients = [
      ['#fbbf24', '#d97706'], // Amber
      ['#f59e0b', '#b45309'], // Orange
      ['#fcd34d', '#f59e0b'], // Yellow
    ] as const;
    // Special gradients for dark mode can be added here if needed, keeping simple for now
    return gradients[index % gradients.length];
  };

  const renderCursoCard = (curso: Curso, index: number) => {
    const gradientColors = getGradientColors(index);
    const isFinished = vistaActual === 'finalizados';

    return (
      <Animated.View
        key={curso.id_curso}
        entering={FadeInDown.delay(100 * index).duration(400)}
        style={[styles.cardContainer, { shadowColor: theme.text }]}
      >
        <LinearGradient
          colors={darkMode ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
          style={[styles.card, { borderColor: theme.border }]}
        >
          {/* Header Gradient Stripe */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardHeaderStrip}
          />

          <View style={styles.cardContent}>
            {/* Header Info */}
            <View style={styles.cardHeader}>
              <View style={styles.headerTopRow}>
                <View style={styles.badgesContainer}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{curso.codigo_curso}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: isFinished ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)' }
                  ]}>
                    <Ionicons
                      name={isFinished ? "trophy" : "time"}
                      size={10}
                      color={isFinished ? theme.warning : theme.success}
                    />
                    <Text style={[
                      styles.statusText,
                      { color: isFinished ? theme.warning : theme.success }
                    ]}>
                      {isFinished ? 'FINALIZADO' : 'EN CURSO'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={2}>
                {curso.nombre}
              </Text>
              <Text style={[styles.courseType, { color: theme.textSecondary }]}>
                {curso.tipo_curso}
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <View style={[styles.iconBox, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="calendar-outline" size={14} color={theme.accent} />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={[styles.detailLabel, { color: theme.textMuted }]}>PERÍODO ACADÉMICO</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {formatearFecha(curso.fecha_inicio)} - {formatearFecha(curso.fecha_fin)}
                  </Text>
                  <Text style={[styles.detailSub, { color: theme.textMuted }]}>
                    {calcularDuracion(curso.fecha_inicio, curso.fecha_fin)}
                  </Text>
                </View>
              </View>

              {curso.docente.nombre_completo && (
                <View style={styles.detailRow}>
                  <View style={[styles.iconBox, { backgroundColor: `${theme.accent}15` }]}>
                    <Ionicons name="person-outline" size={14} color={theme.accent} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>DOCENTE</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
                      {curso.docente.nombre_completo}
                    </Text>
                    {curso.docente.titulo && (
                      <Text style={[styles.detailSub, { color: theme.textMuted }]}>{curso.docente.titulo}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Horario - Only show if data exists */}
              {curso.horario.hora_inicio && (
                <View style={styles.detailRow}>
                  <View style={[styles.iconBox, { backgroundColor: `${theme.accent}15` }]}>
                    <Ionicons name="time-outline" size={14} color={theme.accent} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>HORARIO</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {curso.horario.hora_inicio} - {curso.horario.hora_fin}
                    </Text>
                    {curso.horario.dias && (
                      <Text style={[styles.detailSub, { color: theme.textMuted }]}>{curso.horario.dias}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* Stats Grid */}
            <View style={[styles.statsGrid, { backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(241, 245, 249, 0.5)' }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.accent }]}>{curso.progreso}%</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>PROGRESO</Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: curso.calificacion >= 7 ? theme.success : theme.warning }]}>
                  {curso.calificacion != null ? Number(curso.calificacion).toFixed(1) : '0.0'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>PROMEDIO</Text>
              </View>

              {!isFinished && (
                <>
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: curso.tareasPendientes > 0 ? theme.warning : theme.success }]}>
                      {curso.tareasPendientes}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>PENDIENTES</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const cursosAMostrar = vistaActual === 'activos' ? cursosActivos : cursosFinalizados;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Premium Header with Gradient */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={darkMode ? ['#b45309', '#78350f'] : ['#fbbf24', '#d97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Historial Académico</Text>
              <Text style={styles.headerSubtitle}>Trayectoria y Cursos</Text>
            </View>
            <View style={styles.headerIconContainer}>
              <Ionicons name="school" size={24} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Header Tabs */}
      <View style={[styles.tabsWrapper, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            vistaActual === 'activos' && styles.tabItemActive,
            vistaActual === 'activos' && { backgroundColor: theme.accent }
          ]}
          onPress={() => setVistaActual('activos')}
        >
          <Ionicons name="book-outline" size={16} color={vistaActual === 'activos' ? '#fff' : theme.textMuted} />
          <Text style={[
            styles.tabText,
            { color: vistaActual === 'activos' ? '#fff' : theme.textMuted }
          ]}>
            Activos ({cursosActivos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            vistaActual === 'finalizados' && styles.tabItemActive,
            vistaActual === 'finalizados' && { backgroundColor: theme.accent }
          ]}
          onPress={() => setVistaActual('finalizados')}
        >
          <Ionicons name="trophy-outline" size={16} color={vistaActual === 'finalizados' ? '#fff' : theme.textMuted} />
          <Text style={[
            styles.tabText,
            { color: vistaActual === 'finalizados' ? '#fff' : theme.textMuted }
          ]}>
            Finalizados ({cursosFinalizados.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {cursosAMostrar.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.cardBg }]}>
            <Ionicons
              name={vistaActual === 'activos' ? "library-outline" : "ribbon-outline"}
              size={64}
              color={theme.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {vistaActual === 'activos' ? 'No tienes cursos activos' : 'No tienes cursos finalizados'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              {vistaActual === 'activos'
                ? 'Tus cursos en progreso aparecerán aquí'
                : 'Tus logros académicos aparecerán aquí'}
            </Text>
          </View>
        ) : (
          cursosAMostrar.map((curso, index) => renderCursoCard(curso, index))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header Styles
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
    zIndex: 10
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginTop: 2,
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabsWrapper: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  tabItemActive: {
    elevation: 2,
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardContainer: {
    marginBottom: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeaderStrip: {
    height: 6,
    width: '100%',
  },
  cardContent: {
    padding: 0,
  },
  cardHeader: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366f1',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  courseType: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.5,
  },
  detailsContainer: {
    padding: 20,
    paddingVertical: 16,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailSub: {
    fontSize: 11,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
    opacity: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
