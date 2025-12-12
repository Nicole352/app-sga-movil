import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Estudiante {
  id_usuario: number;
  nombre: string;
  apellido: string;
  cedula: string;
  email: string;
  telefono?: string;
  curso_nombre: string;
  codigo_curso: string;
  promedio?: number;
  fecha_inicio_curso?: string;
  fecha_fin_curso?: string;
  estado_curso?: 'activo' | 'finalizado' | 'planificado' | 'cancelado';
  fecha_matricula?: string;
}

export default function MisEstudiantesScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState<string>('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activos' | 'finalizados'>('todos');

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
      await fetchEstudiantes();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEstudiantes();
    setRefreshing(false);
  };

  const fetchEstudiantes = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/mis-estudiantes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const sortedData = [...data].sort((a: Estudiante, b: Estudiante) => {
          const apellidoA = (a.apellido || '').trim().toUpperCase();
          const apellidoB = (b.apellido || '').trim().toUpperCase();
          return apellidoA.localeCompare(apellidoB, 'es');
        });
        setEstudiantes(sortedData);
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
    green: '#10b981',
    orange: '#f59e0b',
    purple: '#8b5cf6',
  };

  const cursosUnicos = Array.from(new Set(estudiantes.map(e => `${e.codigo_curso}||${e.curso_nombre}`)))
    .map(k => ({ codigo: k.split('||')[0], nombre: k.split('||')[1] }));

  const estudiantesFiltrados = estudiantes.filter(est => {
    const matchTexto =
      est.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.cedula.includes(searchTerm) ||
      est.curso_nombre.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCurso = !cursoFiltro || est.codigo_curso === cursoFiltro;

    const studentEstado = est.estado_curso || 'activo';

    const matchEstado = estadoFiltro === 'todos' ||
      (estadoFiltro === 'activos' && studentEstado === 'activo') ||
      (estadoFiltro === 'finalizados' && studentEstado === 'finalizado');

    return matchTexto && matchCurso && matchEstado;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const getEstadoColor = (estado?: string) => {
    const studentEstado = estado || 'activo';
    switch (studentEstado) {
      case 'activo':
        return { bg: 'rgba(16, 185, 129, 0.2)', color: theme.green };
      case 'finalizado':
        return { bg: 'rgba(156, 163, 175, 0.2)', color: theme.textMuted };
      case 'planificado':
        return { bg: 'rgba(245, 158, 11, 0.2)', color: theme.orange };
      case 'cancelado':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', color: theme.textMuted };
    }
  };

  const getEstadoText = (estado?: string) => {
    const studentEstado = estado || 'activo';
    switch (studentEstado) {
      case 'activo': return 'Activo';
      case 'finalizado': return 'Finalizado';
      case 'planificado': return 'Planificado';
      case 'cancelado': return 'Cancelado';
      default: return 'Activo';
    }
  };

  const promedioGeneral = estudiantesFiltrados.length > 0
    ? (estudiantesFiltrados.reduce((acc, e) => acc + (e.promedio || 0), 0) / estudiantesFiltrados.length).toFixed(1)
    : '0.0';

  const destacados = estudiantesFiltrados.filter(e => e.promedio && e.promedio >= 8).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mis Estudiantes</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Gestiona y monitorea el progreso de tus estudiantes
        </Text>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.accent }]}>
          <Ionicons name="people" size={14} color="#fff" />
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{estudiantesFiltrados.length}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.green }]}>
          <Ionicons name="trophy" size={14} color="#fff" />
          <Text style={styles.statLabel}>Destacados</Text>
          <Text style={styles.statValue}>{destacados}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.orange }]}>
          <Ionicons name="star" size={14} color="#fff" />
          <Text style={styles.statLabel}>Promedio</Text>
          <Text style={styles.statValue}>{promedioGeneral}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.purple }]}>
          <Ionicons name="book" size={14} color="#fff" />
          <Text style={styles.statLabel}>Cursos</Text>
          <Text style={styles.statValue}>{cursosUnicos.length}</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={[styles.filtersContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.searchContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por nombre, cédula..."
            placeholderTextColor={theme.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <View style={[styles.pickerContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Picker
            selectedValue={cursoFiltro}
            onValueChange={(value) => setCursoFiltro(value)}
            style={[styles.picker, { color: theme.text }]}
            dropdownIconColor={theme.text}
          >
            <Picker.Item label="Todos los cursos" value="" />
            {cursosUnicos.map(c => (
              <Picker.Item key={c.codigo} label={`${c.codigo} - ${c.nombre}`} value={c.codigo} />
            ))}
          </Picker>
        </View>

        <View style={[styles.pickerContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Picker
            selectedValue={estadoFiltro}
            onValueChange={(value) => setEstadoFiltro(value as 'todos' | 'activos' | 'finalizados')}
            style={[styles.picker, { color: theme.text }]}
            dropdownIconColor={theme.text}
          >
            <Picker.Item label="Todos los estados" value="todos" />
            <Picker.Item label="Cursos Activos" value="activos" />
            <Picker.Item label="Cursos Finalizados" value="finalizados" />
          </Picker>
        </View>
      </View>

      {/* Lista de Estudiantes */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando estudiantes...</Text>
          </View>
        ) : estudiantesFiltrados.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {searchTerm || cursoFiltro || estadoFiltro !== 'todos'
                ? 'No se encontraron estudiantes'
                : 'No tienes estudiantes asignados'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {searchTerm || cursoFiltro || estadoFiltro !== 'todos'
                ? 'Intenta con otros términos de búsqueda'
                : 'Los estudiantes aparecerán aquí cuando se matriculen'}
            </Text>
          </View>
        ) : (
          <View style={styles.estudiantesList}>
            {estudiantesFiltrados.map((estudiante) => {
              const estadoColor = getEstadoColor(estudiante.estado_curso);
              const estadoText = getEstadoText(estudiante.estado_curso);

              return (
                <View key={`${estudiante.id_usuario}-${estudiante.codigo_curso}`} style={[styles.estudianteCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  {/* Header */}
                  <View style={styles.estudianteHeader}>
                    <View style={[styles.estudianteAvatar, { backgroundColor: theme.accent }]}>
                      <Text style={styles.estudianteAvatarText}>
                        {estudiante.nombre.charAt(0)}{estudiante.apellido.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.estudianteInfo}>
                      <Text style={[styles.estudianteNombre, { color: theme.text }]}>
                        {estudiante.apellido}, {estudiante.nombre}
                      </Text>
                      <Text style={[styles.estudianteCedula, { color: theme.textMuted }]}>
                        {estudiante.cedula}
                      </Text>
                    </View>
                    <View style={[styles.estudianteEstadoBadge, { backgroundColor: estadoColor.bg }]}>
                      <Text style={[styles.estudianteEstadoText, { color: estadoColor.color }]}>
                        {estadoText}
                      </Text>
                    </View>
                  </View>

                  {/* Curso y Fechas */}
                  <View style={[styles.estudianteDetails, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.04)' }]}>
                    <View style={styles.estudianteCurso}>
                      <Ionicons name="book" size={14} color={theme.accent} />
                      <View style={[styles.cursoBadge, { backgroundColor: theme.accent + '30' }]}>
                        <Text style={[styles.cursoBadgeText, { color: theme.accent }]}>
                          {estudiante.codigo_curso}
                        </Text>
                      </View>
                      <Text style={[styles.cursoNombre, { color: theme.text }]} numberOfLines={1}>
                        {estudiante.curso_nombre}
                      </Text>
                    </View>

                    <View style={[styles.separator, { backgroundColor: theme.border }]} />

                    <View style={styles.estudianteFechas}>
                      <View style={styles.fechaItem}>
                        <Ionicons name="calendar" size={12} color={theme.textMuted} />
                        <View>
                          <Text style={[styles.fechaLabel, { color: theme.textMuted }]}>Inicio</Text>
                          <Text style={[styles.fechaValue, { color: theme.text }]}>
                            {formatDate(estudiante.fecha_inicio_curso)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.separator, { backgroundColor: theme.border }]} />

                      <View style={styles.fechaItem}>
                        <Ionicons name="calendar" size={12} color={theme.textMuted} />
                        <View>
                          <Text style={[styles.fechaLabel, { color: theme.textMuted }]}>Fin</Text>
                          <Text style={[styles.fechaValue, { color: theme.text }]}>
                            {formatDate(estudiante.fecha_fin_curso)}
                          </Text>
                        </View>
                      </View>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 6,
  },
  statCard: {
    flex: 1,
    padding: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#fff',
    fontSize: 7.5,
    fontWeight: '700',
  },
  statValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  filtersContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 45,
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
  estudiantesList: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  estudianteCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  estudianteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  estudianteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  estudianteInfo: {
    flex: 1,
  },
  estudianteNombre: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  estudianteCedula: {
    fontSize: 11,
  },
  estudianteEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estudianteEstadoText: {
    fontSize: 10,
    fontWeight: '700',
  },
  estudianteDetails: {
    padding: 10,
    gap: 12,
  },
  estudianteCurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cursoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cursoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cursoNombre: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 24,
  },
  estudianteFechas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fechaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fechaLabel: {
    fontSize: 9,
  },
  fechaValue: {
    fontSize: 11,
    fontWeight: '600',
  },
});
