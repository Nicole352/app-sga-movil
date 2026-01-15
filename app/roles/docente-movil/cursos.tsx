import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  aula_nombre?: string;
  aula_ubicacion?: string;
  hora_inicio?: string;
  hora_fin?: string;
  dias?: string;
  total_estudiantes: number;
  capacidad_maxima: number;
}

export default function MisCursosScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [filteredCursos, setFilteredCursos] = useState<Curso[]>([]);
  const [activeTab, setActiveTab] = useState<'activos' | 'finalizados'>('activos');

  useEffect(() => {
    loadData();

    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  useEffect(() => {
    filterCursos();
  }, [cursos, activeTab]);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchMisCursos();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMisCursos();
    setRefreshing(false);
  };

  const fetchMisCursos = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/todos-mis-cursos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCursos(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCursos = () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (activeTab === 'activos') {
      setFilteredCursos(cursos.filter(curso => {
        const fechaFin = new Date(curso.fecha_fin);
        fechaFin.setHours(0, 0, 0, 0);
        return (curso.estado === 'activo' || curso.estado === 'planificado') && fechaFin >= hoy;
      }));
    } else {
      setFilteredCursos(cursos.filter(curso => {
        const fechaFin = new Date(curso.fecha_fin);
        fechaFin.setHours(0, 0, 0, 0);
        return curso.estado === 'finalizado' || curso.estado === 'cancelado' || fechaFin < hoy;
      }));
    }
  };

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#3b82f6',
      primaryGradient: ['#3b82f6', '#2563eb'] as const,
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
    };

  const coloresGradiente = [
    ['#3b82f6', '#2563eb'],
    ['#10b981', '#059669'],
    ['#f59e0b', '#d97706'],
    ['#8b5cf6', '#7c3aed'],
    ['#ec4899', '#db2777'],
    ['#06b6d4', '#0891b2']
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* PREMIUM HEADER - CLEAN NIKE EFFECT */}
      <Animated.View entering={FadeInDown.duration(400)}>
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
              <Text style={[styles.headerTitle, { color: theme.text }]}>Mis Cursos</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona tus cursos y estudiantes</Text>
            </View>
            <Ionicons name="book" size={28} color={theme.accent} />
          </View>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'activos' && styles.tabActive,
            {
              backgroundColor: activeTab === 'activos'
                ? theme.accent
                : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              borderColor: theme.border
            }
          ]}
          onPress={() => setActiveTab('activos')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'activos' ? '#000' : theme.textSecondary }
          ]}>
            Cursos Activos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'finalizados' && styles.tabActive,
            {
              backgroundColor: activeTab === 'finalizados'
                ? theme.accent
                : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              borderColor: theme.border
            }
          ]}
          onPress={() => setActiveTab('finalizados')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'finalizados' ? '#000' : theme.textSecondary }
          ]}>
            Finalizados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Cursos */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando cursos...</Text>
          </View>
        ) : filteredCursos.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="book-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {activeTab === 'activos' ? 'No tienes cursos activos' : 'No tienes cursos finalizados'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {activeTab === 'activos'
                ? 'Tus cursos activos aparecerán aquí'
                : 'Tus cursos finalizados aparecerán aquí'}
            </Text>
          </View>
        ) : (
          <View style={styles.cursosList}>
            {filteredCursos.map((curso, index) => {
              const [color1, color2] = coloresGradiente[index % coloresGradiente.length];

              return (
                <View key={curso.id_curso} style={[styles.cursoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  {/* Header SIN gradiente masivo, solo acento sutil */}
                  <View style={styles.cursoHeader}>
                    <View style={[styles.accentStrip, { backgroundColor: color1 }]} />

                    <View style={styles.cursoHeaderTop}>
                      <View style={[styles.cursoBadge, { backgroundColor: color1 + '15' }]}>
                        <Text style={[styles.cursoBadgeText, { color: color1 }]}>{curso.codigo_curso}</Text>
                      </View>
                      <View style={[
                        styles.cursoEstadoBadge,
                        { backgroundColor: curso.estado === 'activo' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }
                      ]}>
                        <Text style={[
                          styles.cursoEstadoText,
                          { color: curso.estado === 'activo' ? theme.accent : '#f59e0b' }
                        ]}>{curso.estado.toUpperCase()}</Text>
                      </View>
                    </View>

                    <Text style={[styles.cursoNombre, { color: theme.text }]}>{curso.nombre}</Text>

                    {/* Estadística */}
                    <View style={styles.cursoStats}>
                      <View style={[styles.cursoStatsBox, { backgroundColor: theme.bg }]}>
                        <View style={styles.cursoStatsHeader}>
                          <Ionicons name="people" size={14} color={color1} />
                          <Text style={[styles.cursoStatsLabel, { color: theme.textMuted }]}>Estudiantes</Text>
                        </View>
                        <Text style={[styles.cursoStatsValue, { color: theme.text }]}>{curso.total_estudiantes}</Text>
                        <Text style={[styles.cursoStatsSubtext, { color: theme.textSecondary }]}>de {curso.capacidad_maxima}</Text>
                      </View>

                      <View style={[styles.cursoProgress, { backgroundColor: theme.bg }]}>
                        <View style={[styles.progressCircle, { borderColor: color1, borderTopColor: 'transparent' }]} />
                        <Text style={[styles.cursoProgressText, { color: theme.text }]}>
                          {Math.round((curso.total_estudiantes / curso.capacidad_maxima) * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Contenido */}
                  <View style={styles.cursoContent}>
                    {/* Información en grid */}
                    <View style={styles.cursoInfoGrid}>
                      {curso.aula_nombre && (
                        <View style={[styles.cursoInfoBox, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                          <View style={styles.cursoInfoHeader}>
                            <Ionicons name="location" size={12} color="#10b981" />
                            <Text style={[styles.cursoInfoLabel, { color: theme.textMuted }]}>AULA</Text>
                          </View>
                          <Text style={[styles.cursoInfoValue, { color: theme.text }]}>{curso.aula_nombre}</Text>
                          {curso.aula_ubicacion && (
                            <Text style={[styles.cursoInfoSubtext, { color: theme.textMuted }]}>
                              {curso.aula_ubicacion}
                            </Text>
                          )}
                        </View>
                      )}

                      {curso.hora_inicio && (
                        <View style={[styles.cursoInfoBox, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                          <View style={styles.cursoInfoHeader}>
                            <Ionicons name="time" size={12} color={color1} />
                            <Text style={[styles.cursoInfoLabel, { color: theme.textMuted }]}>HORARIO</Text>
                          </View>
                          <Text style={[styles.cursoInfoValue, { color: theme.text }]}>
                            {curso.hora_inicio.substring(0, 5)} - {curso.hora_fin?.substring(0, 5)}
                          </Text>
                          {curso.dias && (
                            <View style={styles.cursoDias}>
                              {curso.dias.split(',').slice(0, 3).map((dia, idx) => (
                                <View key={idx} style={[styles.cursoDiaTag, { backgroundColor: color1 + '30' }]}>
                                  <Text style={[styles.cursoDiaText, { color: color1 }]}>{dia.trim()}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Período */}
                    <View style={[styles.cursoPeriodo, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                      <View style={styles.cursoPeriodoHeader}>
                        <Ionicons name="calendar" size={12} color="#f59e0b" />
                        <Text style={[styles.cursoInfoLabel, { color: theme.textMuted }]}>PERÍODO ACADÉMICO</Text>
                      </View>
                      <View style={styles.cursoPeriodoContent}>
                        <Text style={[styles.cursoPeriodoDate, { color: theme.text }]}>
                          {formatDate(curso.fecha_inicio)}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                        <Text style={[styles.cursoPeriodoDate, { color: theme.text }]}>
                          {formatDateFull(curso.fecha_fin)}
                        </Text>
                      </View>
                    </View>

                    {/* Acciones */}
                    <View style={styles.cursoActions}>
                      <TouchableOpacity
                        style={[styles.cursoActionPrimary, { backgroundColor: color1 }]}
                        onPress={() => router.push(`/roles/docente-movil/detallecursodocente?id=${curso.id_curso}` as any)}
                      >
                        <Ionicons name="book" size={16} color="#fff" />
                        <Text style={styles.cursoActionPrimaryText}>Gestión de Módulos</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.cursoActionSecondary, { borderColor: color1 }]}
                        onPress={() => router.push(`/roles/docente-movil/calificaciones?id=${curso.id_curso}` as any)}
                      >
                        <Ionicons name="stats-chart" size={16} color={color1} />
                        <Text style={[styles.cursoActionSecondaryText, { color: color1 }]}>Calificaciones del Curso</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20, // Aggressive reduction
    paddingBottom: 10, // Aggressive reduction
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20, // Slightly smaller radius for tighter look
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    margin: 16,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cursosList: {
    padding: 16,
    gap: 16,
  },
  cursoCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cursoHeader: {
    padding: 8, // Ultra compact
    paddingLeft: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cursoHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4, // Ultra compact
  },
  cursoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cursoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cursoEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cursoEstadoText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cursoNombre: {
    fontSize: 13, // Ultra compact font
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 16,
  },
  cursoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cursoStatsBox: {
    flex: 1,
    padding: 6, // Ultra compact
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cursoStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  cursoStatsLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  cursoStatsValue: {
    fontSize: 13, // Ultra compact
    fontWeight: '800',
    lineHeight: 15,
    marginTop: 1,
  },
  cursoStatsSubtext: {
    fontSize: 10,
    marginTop: 1,
  },
  cursoProgress: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  progressCircle: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 3,
    opacity: 0.3
  },
  cursoProgressText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cursoContent: {
    padding: 8, // Ultra compact
  },
  cursoInfoGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  cursoInfoBox: {
    flex: 1,
    padding: 6, // Reduced padding
    borderRadius: 8,
    borderWidth: 1,
  },
  cursoInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 3,
  },
  cursoInfoLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  cursoInfoValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  cursoInfoSubtext: {
    fontSize: 9,
    marginTop: 2,
  },
  cursoDias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  cursoDiaTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cursoDiaText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cursoPeriodo: {
    padding: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  cursoPeriodoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  cursoPeriodoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cursoPeriodoDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  cursoActions: {
    flexDirection: 'row',
    gap: 6,
  },
  cursoActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cursoActionPrimaryText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  cursoActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  cursoActionSecondaryText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
