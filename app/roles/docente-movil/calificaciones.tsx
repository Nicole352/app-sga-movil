import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  total_estudiantes: number;
  fecha_fin?: string;
  estado?: 'activo' | 'finalizado' | 'planificado' | 'cancelado';
}

export default function CalificacionesScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [activeTab, setActiveTab] = useState<'activos' | 'finalizados'>('activos');

  useEffect(() => {
    loadData();

    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchCursos();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCursos();
    setRefreshing(false);
  };

  const fetchCursos = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/todos-mis-cursos`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.6)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
    primary: '#2563eb',
    accent: '#3b82f6',
    primaryGradient: ['#3b82f6', '#2563eb'] as const,
  };

  const filteredCursos = cursos.filter(curso => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaFin = new Date(curso.fecha_fin || new Date());
    fechaFin.setHours(0, 0, 0, 0);

    const cursoEstado = curso.estado || 'activo';

    if (activeTab === 'activos') {
      return (cursoEstado === 'activo' || cursoEstado === 'planificado') && fechaFin >= hoy;
    } else {
      return cursoEstado === 'finalizado' || cursoEstado === 'cancelado' || fechaFin < hoy;
    }
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Premium Header */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <LinearGradient
          colors={theme.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'column', gap: 4 }}>
              <Text style={styles.headerTitle}>Calificaciones</Text>
              <Text style={styles.headerSubtitle}>Gestión Académica</Text>
            </View>
            <Ionicons name="ribbon" size={28} color="#fff" />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'activos' && styles.tabActive,
            {
              backgroundColor: activeTab === 'activos'
                ? theme.accent
                : (darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
            }
          ]}
          onPress={() => setActiveTab('activos')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'activos' ? '#fff' : theme.textSecondary }
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
                : (darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
            }
          ]}
          onPress={() => setActiveTab('finalizados')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'finalizados' ? '#fff' : theme.textSecondary }
          ]}>
            Finalizados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Cursos */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 40 }}
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
            <LinearGradient
              colors={darkMode ? ['#1e293b', '#0f172a'] : ['#f1f5f9', '#e2e8f0']}
              style={styles.emptyIconBg}
            >
              <Ionicons name="book-outline" size={32} color={theme.textMuted} />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {activeTab === 'activos' ? 'No tienes cursos activos' : 'No tienes cursos finalizados'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {activeTab === 'activos'
                ? 'Los cursos activos aparecerán aquí cuando se asignen'
                : 'Los cursos finalizados aparecerán aquí cuando se completen'}
            </Text>
          </View>
        ) : (
          <View style={styles.cursosList}>
            {filteredCursos.map((curso, index) => (
              <Animated.View
                key={curso.id_curso}
                entering={FadeInDown.delay(index * 100).springify()}
              >
                <TouchableOpacity
                  style={[styles.cursoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                  onPress={() => {
                    router.push(`/roles/docente-movil/calificaciones-curso?id=${curso.id_curso}` as any);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={styles.cursoHeader}>
                    {/* Badge de Código con gradiente sutil */}
                    <LinearGradient
                      colors={darkMode ? ['rgba(59, 130, 246, 0.2)', 'rgba(37, 99, 235, 0.2)'] : ['#eff6ff', '#dbeafe']}
                      style={styles.cursoBadge}
                    >
                      <Text style={[styles.cursoBadgeText, { color: theme.primary }]}>
                        {curso.codigo_curso}
                      </Text>
                    </LinearGradient>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>

                  <Text style={[styles.cursoNombre, { color: theme.text }]}>
                    {curso.nombre}
                  </Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.cursoStat}>
                      <Ionicons name="people-outline" size={16} color={theme.textMuted} />
                      <Text style={[styles.cursoStatText, { color: theme.textMuted }]}>
                        {curso.total_estudiantes} estudiantes
                      </Text>
                    </View>
                    {curso.fecha_fin && (
                      <View style={styles.cursoStat}>
                        <Ionicons name="calendar-outline" size={16} color={theme.textMuted} />
                        <Text style={[styles.cursoStatText, { color: theme.textMuted }]}>
                          Fin: {new Date(curso.fecha_fin).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
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
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flexDirection: 'row',
    padding: 16,
    paddingTop: 20,
    gap: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
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
    marginTop: 10,
  },
  emptyContainer: {
    margin: 20,
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  cursosList: {
    padding: 20,
    gap: 16,
  },
  cursoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cursoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cursoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cursoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cursoNombre: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  cursoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cursoStatText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
