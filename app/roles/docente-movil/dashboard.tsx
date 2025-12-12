import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getToken, getUserData, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

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
}

export default function MiAulaScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [cursos, setCursos] = useState<CursoResumen[]>([]);

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
      console.log('UserData en dashboard:', user);
      setUserData(user);
      await fetchCursos();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchCursos = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        console.log('No hay token');
        return;
      }

      console.log('Obteniendo cursos del docente...');
      const response = await fetch(`${API_URL}/docentes/mis-cursos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Respuesta:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Cursos obtenidos:', data);
        setCursos(Array.isArray(data) ? data : []);
      } else {
        console.error('Error obteniendo cursos:', response.status);
        setCursos([]);
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
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#8b5cf6',
  };

  const totalEstudiantes = cursos.reduce((acc, curso) => acc + curso.total_estudiantes, 0);
  const capacidadTotal = cursos.reduce((acc, curso) => acc + curso.capacidad_maxima, 0);
  const promedioOcupacion = capacidadTotal > 0 ? Math.round((totalEstudiantes / capacidadTotal) * 100) : 0;
  const cursosActivos = cursos.filter(c => (c.estado || 'activo') === 'activo').length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  return (
    <View key={darkMode ? 'dark' : 'light'} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.bg }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* Header de Bienvenida */}
        <View style={[styles.welcomeCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.welcomeHeader}>
            <Ionicons name="hand-right" size={24} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                ¡Bienvenido{userData?.nombre ? `, ${userData.nombre}` : ''}!
              </Text>
              {userData?.apellido && (
                <Text style={[styles.welcomeTitle, { color: theme.text }]}>
                  {userData.apellido}
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
            {userData?.titulo_profesional || 'Gestiona tus cursos y estudiantes'}
          </Text>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeItem}>
              <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.dateTimeText, { color: theme.textMuted }]}>
                {new Date().toLocaleDateString('es-ES')}
              </Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Ionicons name="time-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.dateTimeText, { color: theme.textMuted }]}>
                {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Estadísticas rápidas */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', borderColor: theme.blue + '40' }]}>
            <Ionicons name="book" size={20} color={theme.blue} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cursos Activos</Text>
            <Text style={[styles.statValue, { color: theme.blue }]}>{cursosActivos}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)', borderColor: theme.green + '40' }]}>
            <Ionicons name="people" size={20} color={theme.green} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Estudiantes</Text>
            <Text style={[styles.statValue, { color: theme.green }]}>{totalEstudiantes}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)', borderColor: theme.accent + '40' }]}>
            <Ionicons name="stats-chart" size={20} color={theme.accent} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ocupación</Text>
            <Text style={[styles.statValue, { color: theme.accent }]}>{promedioOcupacion}%</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)', borderColor: theme.purple + '40' }]}>
            <Ionicons name="trophy" size={20} color={theme.purple} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Capacidad</Text>
            <Text style={[styles.statValue, { color: theme.purple }]}>{capacidadTotal}</Text>
          </View>
        </View>

        {/* Mis Cursos */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Mis Cursos</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando cursos...</Text>
            </View>
          ) : cursos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No tienes cursos activos</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Tus cursos activos aparecerán aquí cuando se asignen
              </Text>
            </View>
          ) : (
            <View style={styles.cursosList}>
              {cursos.map((curso) => (
                <TouchableOpacity
                  key={curso.id_curso}
                  style={[styles.cursoCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}
                  onPress={() => router.push(`/roles/docente-movil/detallecursodocente?id=${curso.id_curso}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cursoHeader}>
                    <View style={[styles.cursoBadge, { backgroundColor: theme.accent + '30' }]}>
                      <Text style={[styles.cursoBadgeText, { color: theme.accent }]}>{curso.codigo_curso}</Text>
                    </View>
                    <Text style={[styles.cursoDate, { color: theme.textMuted }]}>
                      {curso.fecha_inicio ? formatDate(curso.fecha_inicio) : 'Por definir'}
                    </Text>
                  </View>

                  <Text style={[styles.cursoNombre, { color: theme.text }]}>{curso.nombre}</Text>

                  {curso.aula_nombre && (
                    <View style={styles.cursoAula}>
                      <Ionicons name="location" size={14} color={theme.green} />
                      <Text style={[styles.cursoAulaText, { color: theme.textSecondary }]}>
                        {curso.aula_nombre}{curso.aula_ubicacion && ` - ${curso.aula_ubicacion}`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.cursoFooter}>
                    <View style={styles.cursoEstudiantes}>
                      <Ionicons name="people-outline" size={14} color={theme.textMuted} />
                      <Text style={[styles.cursoEstudiantesText, { color: theme.textMuted }]}>
                        {curso.total_estudiantes} estudiantes
                      </Text>
                    </View>

                    <View style={styles.cursoCapacidad}>
                      <Text style={[styles.capacidadValue, { color: theme.accent }]}>
                        {curso.total_estudiantes}/{curso.capacidad_maxima}
                      </Text>
                      <View style={[styles.progressBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${(curso.total_estudiantes / curso.capacidad_maxima) * 100}%`,
                              backgroundColor: theme.accent
                            }
                          ]}
                        />
                      </View>
                      <Text style={[styles.capacidadPercent, { color: theme.textMuted }]}>
                        {Math.round((curso.total_estudiantes / curso.capacidad_maxima) * 100)}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Próximas Clases */}
        {cursosActivos > 0 && (
          <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Próximas Clases</Text>
            <View style={styles.proximasClasesList}>
              {cursos.filter(c => (c.estado || 'activo') === 'activo').slice(0, 3).map((curso, index) => (
                <View key={curso.id_curso} style={[styles.proximaClaseItem, { borderColor: theme.border }]}>
                  <View style={[styles.proximaClaseDot, { backgroundColor: index === 0 ? theme.accent : theme.green }]} />
                  <View style={styles.proximaClaseContent}>
                    <Text style={[styles.proximaClaseFecha, { color: theme.text }]}>
                      {formatDate(curso.fecha_inicio)}
                    </Text>
                    <Text style={[styles.proximaClaseNombre, { color: theme.textSecondary }]} numberOfLines={1}>
                      {curso.nombre}
                    </Text>
                    {curso.aula_nombre && (
                      <Text style={[styles.proximaClaseAula, { color: theme.textMuted }]} numberOfLines={1}>
                        {curso.aula_nombre}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Acceso Rápido */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Acceso Rápido</Text>
          <View style={styles.quickAccessList}>
            <TouchableOpacity
              style={[styles.quickAccessItem, { borderColor: theme.border }]}
              onPress={() => router.push('/roles/docente-movil/calificaciones' as any)}
            >
              <Ionicons name="trending-up" size={20} color={theme.accent} />
              <Text style={[styles.quickAccessText, { color: theme.textSecondary }]}>Calificaciones</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAccessItem, { borderColor: theme.border }]}
              onPress={() => router.push('/roles/docente-movil/horario' as any)}
            >
              <Ionicons name="calendar" size={20} color={theme.accent} />
              <Text style={[styles.quickAccessText, { color: theme.textSecondary }]}>Horario</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAccessItem, { borderColor: theme.border }]}
              onPress={() => router.push('/roles/docente-movil/estudiantes' as any)}
            >
              <Ionicons name="people" size={20} color={theme.accent} />
              <Text style={[styles.quickAccessText, { color: theme.textSecondary }]}>Lista de Estudiantes</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
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
  welcomeCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  welcomeSubtitle: {
    fontSize: 10,
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeText: {
    fontSize: 9,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 44) / 2,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 7.5,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
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
    gap: 12,
  },
  cursoCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cursoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cursoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cursoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cursoDate: {
    fontSize: 10,
  },
  cursoNombre: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  cursoAula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cursoAulaText: {
    fontSize: 12,
  },
  cursoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cursoEstudiantes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cursoEstudiantesText: {
    fontSize: 11,
  },
  cursoCapacidad: {
    alignItems: 'flex-end',
    gap: 4,
  },
  capacidadValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    width: 80,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  capacidadPercent: {
    fontSize: 10,
  },
  proximasClasesList: {
    gap: 8,
  },
  proximaClaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  proximaClaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  proximaClaseContent: {
    flex: 1,
  },
  proximaClaseFecha: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  proximaClaseNombre: {
    fontSize: 10,
    marginBottom: 2,
  },
  proximaClaseAula: {
    fontSize: 9,
  },
  quickAccessList: {
    gap: 8,
  },
  quickAccessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
