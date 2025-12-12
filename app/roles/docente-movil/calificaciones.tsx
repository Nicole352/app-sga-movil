import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
    accent: '#3b82f6',
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Calificaciones</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Selecciona un curso para ver las calificaciones
        </Text>
      </View>

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
                : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              borderColor: theme.border
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
                ? 'Los cursos activos aparecerán aquí cuando se asignen' 
                : 'Los cursos finalizados aparecerán aquí cuando se completen'}
            </Text>
          </View>
        ) : (
          <View style={styles.cursosList}>
            {filteredCursos.map((curso) => (
              <TouchableOpacity
                key={curso.id_curso}
                style={[styles.cursoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => {
                  // Navegar a la pantalla de calificaciones del curso
                  router.push(`/roles/docente-movil/calificaciones-curso?id=${curso.id_curso}` as any);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cursoHeader}>
                  <View style={styles.cursoInfo}>
                    <View style={[styles.cursoBadge, { backgroundColor: theme.accent + '30' }]}>
                      <Text style={[styles.cursoBadgeText, { color: theme.accent }]}>
                        {curso.codigo_curso}
                      </Text>
                    </View>
                    <Text style={[styles.cursoNombre, { color: theme.text }]}>
                      {curso.nombre}
                    </Text>
                    <View style={styles.cursoEstudiantes}>
                      <Ionicons name="people" size={16} color={theme.textMuted} />
                      <Text style={[styles.cursoEstudiantesText, { color: theme.textMuted }]}>
                        {curso.total_estudiantes} estudiantes
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={theme.accent} />
                </View>
              </TouchableOpacity>
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
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
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
    gap: 12,
  },
  cursoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cursoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cursoInfo: {
    flex: 1,
    marginRight: 12,
  },
  cursoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
  },
  cursoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cursoNombre: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  cursoEstudiantes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cursoEstudiantesText: {
    fontSize: 12,
  },
});
