import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Tarea {
  id_tarea: number;
  titulo: string;
  nota_maxima: number;
  ponderacion?: number;
  id_modulo?: number;
  modulo_nombre?: string;
}

interface ModuloDetalle {
  nombre_modulo: string;
  promedio_modulo_sobre_10: number;
  aporte_al_promedio_global: number;
}

interface Estudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  identificacion?: string;
  calificaciones: { [tareaId: number]: number | null };
  promedio: number;
  promedio_global?: number;
  promedios_modulos?: { [moduloNombre: string]: number };
  modulos_detalle?: ModuloDetalle[];
}

export default function CalificacionesCursoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cursoId = parseInt(params.id as string);

  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cursoNombre, setCursoNombre] = useState('');
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [filteredEstudiantes, setFilteredEstudiantes] = useState<Estudiante[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'aprobados' | 'reprobados'>('todos');
  const [modulos, setModulos] = useState<string[]>([]);
  const [moduloActivo, setModuloActivo] = useState<string>('todos');
  const [tareasFiltradas, setTareasFiltradas] = useState<Tarea[]>([]);

  useEffect(() => {
    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  useEffect(() => {
    loadData();
  }, [cursoId]);

  useEffect(() => {
    if (moduloActivo === 'todos') {
      setTareasFiltradas(tareas);
    } else {
      const tareasDelModulo = tareas.filter(tarea => tarea.modulo_nombre === moduloActivo);
      setTareasFiltradas(tareasDelModulo);
    }
  }, [moduloActivo, tareas]);

  useEffect(() => {
    let result = [...estudiantes];

    if (busqueda) {
      const term = busqueda.toLowerCase();
      result = result.filter(est =>
        est.nombre.toLowerCase().includes(term) ||
        est.apellido.toLowerCase().includes(term)
      );
    }

    if (filtro === 'aprobados') {
      result = result.filter(est => (parseFloat(String(est.promedio_global)) || 0) >= 7);
    } else if (filtro === 'reprobados') {
      result = result.filter(est => (parseFloat(String(est.promedio_global)) || 0) < 7);
    }

    result.sort((a, b) => {
      const apellidoA = (a.apellido || '').trim().toUpperCase();
      const apellidoB = (b.apellido || '').trim().toUpperCase();
      return apellidoA.localeCompare(apellidoB, 'es');
    });

    setFilteredEstudiantes(result);
  }, [estudiantes, busqueda, filtro]);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchCalificaciones();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCalificaciones();
    setRefreshing(false);
  };

  const fetchCalificaciones = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      // Obtener información del curso
      const cursoResponse = await fetch(`${API_URL}/cursos/${cursoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (cursoResponse.ok) {
        const cursoData = await cursoResponse.json();
        setCursoNombre(cursoData.nombre || `Curso ID: ${cursoId}`);
      }

      // Obtener tareas del curso
      const tareasResponse = await fetch(`${API_URL}/cursos/${cursoId}/tareas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let tareasArr: Tarea[] = [];
      if (tareasResponse.ok) {
        try {
          const tareasJson = await tareasResponse.json();
          tareasArr = Array.isArray(tareasJson) ? tareasJson : tareasJson?.tareas || [];
          console.log('Tareas obtenidas:', tareasArr.length);
        } catch (error) {
          console.error('Error parseando tareas:', error);
          tareasArr = [];
        }
      } else {
        console.error('Error en respuesta de tareas:', tareasResponse.status);
      }

      // Obtener estudiantes del curso
      const estudiantesResponse = await fetch(`${API_URL}/cursos/${cursoId}/estudiantes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let estudiantesArr: any[] = [];
      if (estudiantesResponse.ok) {
        try {
          const estudiantesJson = await estudiantesResponse.json();
          estudiantesArr = Array.isArray(estudiantesJson) ? estudiantesJson : estudiantesJson?.estudiantes || [];
          console.log('Estudiantes obtenidos:', estudiantesArr.length);
        } catch (error) {
          console.error('Error parseando estudiantes:', error);
          estudiantesArr = [];
        }
      } else {
        console.error('Error en respuesta de estudiantes:', estudiantesResponse.status);
      }

      // Obtener calificaciones
      const calificacionesResponse = await fetch(`${API_URL}/cursos/${cursoId}/calificaciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let calificacionesArr: any[] = [];
      if (calificacionesResponse.ok) {
        try {
          const calificacionesJson = await calificacionesResponse.json();
          calificacionesArr = Array.isArray(calificacionesJson) ? calificacionesJson : calificacionesJson?.calificaciones || [];
          console.log('Calificaciones obtenidas:', calificacionesArr.length);
        } catch (error) {
          console.error('Error parseando calificaciones:', error);
          calificacionesArr = [];
        }
      } else {
        console.error('Error en respuesta de calificaciones:', calificacionesResponse.status);
      }

      // Obtener calificaciones completas
      const calificacionesCompletasResponse = await fetch(`${API_URL}/calificaciones/curso/${cursoId}/completo`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let datosCompletos: any = { estudiantes: [], modulos: [] };
      if (calificacionesCompletasResponse.ok) {
        try {
          datosCompletos = await calificacionesCompletasResponse.json();
          if (datosCompletos.success) {
            setModulos(datosCompletos.modulos || []);
            console.log('Módulos obtenidos:', datosCompletos.modulos?.length || 0);
          }
        } catch (error) {
          console.error('Error parseando calificaciones completas:', error);
        }
      } else {
        console.error('Error en respuesta de calificaciones completas:', calificacionesCompletasResponse.status);
      }

      // Procesar estudiantes con calificaciones
      const estudiantesConCalificaciones = estudiantesArr.map((est: any) => {
        const califs: { [tareaId: number]: number | null } = {};
        let suma = 0;
        let count = 0;

        tareasArr.forEach((tarea: Tarea) => {
          const calif = calificacionesArr.find(
            (c: any) => c.id_estudiante === est.id_estudiante && c.id_tarea === tarea.id_tarea
          );
          const raw = calif ? calif.nota_obtenida : null;
          const val = raw === null || raw === undefined ? 0 : Number(raw);
          califs[tarea.id_tarea] = Number.isFinite(val as number) ? (val as number) : 0;

          // Siempre sumar y contar, incluso si es 0
          suma += val as number;
          count++;
        });

        const promediosEst = datosCompletos.estudiantes?.find(
          (e: any) => e.id_estudiante === est.id_estudiante
        ) || {};

        return {
          id_estudiante: est.id_estudiante,
          nombre: est.nombre,
          apellido: est.apellido,
          identificacion: est.cedula || est.identificacion || 'N/A',
          calificaciones: califs,
          promedio: count > 0 ? suma / count : 0,
          promedio_global: parseFloat(String(promediosEst.promedio_global)) || 0,
          promedios_modulos: promediosEst.promedios_modulos || {},
          modulos_detalle: promediosEst.modulos_detalle || [],
        };
      });

      console.log('Estudiantes procesados:', estudiantesConCalificaciones.length);

      setTareas(tareasArr);
      setEstudiantes(estudiantesConCalificaciones);
      setTareasFiltradas(tareasArr);
    } catch (error) {
      console.error('Error al cargar calificaciones:', error);
      Alert.alert('Error', 'No se pudieron cargar las calificaciones');
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
    red: '#ef4444',
  };

  const promedioGeneral = filteredEstudiantes.length > 0
    ? (filteredEstudiantes.reduce((acc, e) => acc + (e.promedio_global || 0), 0) / filteredEstudiantes.length).toFixed(2)
    : '0.00';

  const aprobados = filteredEstudiantes.filter(e => (e.promedio_global || 0) >= 7).length;
  const reprobados = filteredEstudiantes.filter(e => (e.promedio_global || 0) < 7).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.accent} />
          <Text style={[styles.backButtonText, { color: theme.accent }]}>Volver</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>{cursoNombre}</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Calificaciones del curso
        </Text>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.accent }]}>
          <Ionicons name="people" size={14} color="#fff" />
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{filteredEstudiantes.length}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.green }]}>
          <Ionicons name="checkmark-circle" size={14} color="#fff" />
          <Text style={styles.statLabel}>Aprobados</Text>
          <Text style={styles.statValue}>{aprobados}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.red }]}>
          <Ionicons name="close-circle" size={14} color="#fff" />
          <Text style={styles.statLabel}>Reprobados</Text>
          <Text style={styles.statValue}>{reprobados}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#f59e0b' }]}>
          <Ionicons name="star" size={14} color="#fff" />
          <Text style={styles.statLabel}>Promedio</Text>
          <Text style={styles.statValue}>{promedioGeneral}</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={[styles.filtersContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.searchContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar estudiante..."
            placeholderTextColor={theme.textMuted}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>

        <View style={styles.filtersRow}>
          <View style={[styles.pickerContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
            <Picker
              selectedValue={filtro}
              onValueChange={(value) => setFiltro(value as 'todos' | 'aprobados' | 'reprobados')}
              style={[styles.picker, { color: theme.text }]}
              dropdownIconColor={theme.text}
            >
              <Picker.Item label="Todos" value="todos" />
              <Picker.Item label="Aprobados" value="aprobados" />
              <Picker.Item label="Reprobados" value="reprobados" />
            </Picker>
          </View>

          {modulos.length > 0 && (
            <View style={[styles.pickerContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
              <Picker
                selectedValue={moduloActivo}
                onValueChange={(value) => setModuloActivo(value)}
                style={[styles.picker, { color: theme.text }]}
                dropdownIconColor={theme.text}
              >
                <Picker.Item label="Todos los módulos" value="todos" />
                {modulos.map(modulo => (
                  <Picker.Item key={modulo} label={modulo} value={modulo} />
                ))}
              </Picker>
            </View>
          )}
        </View>
      </View>

      {/* Tabla de Calificaciones */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando calificaciones...</Text>
          </View>
        ) : filteredEstudiantes.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="school-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay estudiantes</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {busqueda || filtro !== 'todos'
                ? 'No se encontraron estudiantes con los filtros aplicados'
                : 'No hay estudiantes matriculados en este curso'}
            </Text>
          </View>
        ) : (
          <View style={[styles.tableContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {/* Encabezado de la tabla */}
            <View style={styles.tableHeader}>
              {/* Columna fija: Estudiante */}
              <View style={[styles.stickyColumn, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.headerText, { color: theme.text }]}>Estudiante</Text>
              </View>

              {/* Columnas scrollables */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.scrollableColumns}>
                {/* Si está filtrando por módulo, mostrar tareas */}
                {moduloActivo !== 'todos' && tareasFiltradas.map((tarea) => (
                  <View key={tarea.id_tarea} style={[styles.headerCell, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', borderColor: theme.border }]}>
                    <Text style={[styles.headerText, { color: theme.text }]} numberOfLines={2}>
                      {tarea.titulo}
                    </Text>
                    <Text style={[styles.headerSubtext, { color: theme.textMuted }]}>
                      /{tarea.nota_maxima}
                    </Text>
                  </View>
                ))}

                {/* Columna de promedio del módulo activo */}
                {moduloActivo !== 'todos' && (
                  <View style={[styles.headerCell, styles.promedioHeader, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)', borderColor: theme.border }]}>
                    <Text style={[styles.headerText, { color: theme.text }]}>Promedio</Text>
                    <Text style={[styles.headerSubtext, { color: theme.textMuted }]}>{moduloActivo}</Text>
                  </View>
                )}

                {/* Si está en vista "todos", mostrar promedios por módulo */}
                {moduloActivo === 'todos' && modulos.map((modulo, idx) => (
                  <View key={`modulo-${idx}`} style={[styles.headerCell, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)', borderColor: theme.border }]}>
                    <Text style={[styles.headerText, { color: theme.text }]} numberOfLines={2}>
                      {modulo}
                    </Text>
                    <Text style={[styles.headerSubtext, { color: theme.textMuted }]}>
                      Promedio
                    </Text>
                  </View>
                ))}

                {/* Columna de promedio global (solo en vista "todos") */}
                {moduloActivo === 'todos' && (
                  <View style={[styles.headerCell, styles.globalHeader, { backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.15)' : 'rgba(96, 165, 250, 0.1)', borderColor: theme.border }]}>
                    <Text style={[styles.headerText, { color: theme.text }]}>Promedio</Text>
                    <Text style={[styles.headerSubtext, { color: theme.textMuted }]}>Global</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Filas de estudiantes */}
            {filteredEstudiantes.map((estudiante, idx) => {
              const promedioGlobal = estudiante.promedio_global || 0;
              const aprobadoGlobal = promedioGlobal >= 7;

              return (
                <View key={estudiante.id_estudiante} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? (darkMode ? 'rgba(255,255,255,0.02)' : 'transparent') : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'), borderColor: theme.border }]}>
                  {/* Columna fija: Nombre del estudiante */}
                  <View style={[styles.stickyColumn, styles.studentCell, { backgroundColor: idx % 2 === 0 ? (darkMode ? 'rgba(255,255,255,0.02)' : theme.cardBg) : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'), borderColor: theme.border }]}>
                    <View style={[styles.studentAvatar, { backgroundColor: aprobadoGlobal ? theme.green : theme.red }]}>
                      <Text style={styles.avatarText}>
                        {estudiante.nombre.charAt(0)}{estudiante.apellido.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                        {estudiante.apellido}, {estudiante.nombre}
                      </Text>
                      {estudiante.identificacion && (
                        <Text style={[styles.studentId, { color: theme.textMuted }]} numberOfLines={1}>
                          {estudiante.identificacion}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Columnas scrollables */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollableColumns}>
                    {/* Si está filtrando por módulo, mostrar calificaciones de tareas */}
                    {moduloActivo !== 'todos' && tareasFiltradas.map((tarea) => {
                      const nota = estudiante.calificaciones[tarea.id_tarea];
                      const porcentaje = nota !== null && nota > 0 ? (nota / tarea.nota_maxima) * 100 : 0;
                      const color = nota === null || nota === 0
                        ? theme.textMuted
                        : porcentaje >= 70
                          ? theme.green
                          : porcentaje >= 50
                            ? '#f59e0b'
                            : theme.red;

                      return (
                        <View key={tarea.id_tarea} style={[styles.dataCell, { borderColor: theme.border }]}>
                          <View style={[styles.gradeBadge, { backgroundColor: `${color}20` }]}>
                            <Text style={[styles.gradeText, { color }]}>
                              {nota !== null && nota > 0 ? nota.toFixed(1) : '-'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Promedio del módulo activo */}
                    {moduloActivo !== 'todos' && (() => {
                      const moduloDetalle = estudiante.modulos_detalle?.find(m => m.nombre_modulo === moduloActivo);
                      const promedioModulo = moduloDetalle ? parseFloat(String(moduloDetalle.promedio_modulo_sobre_10)) : 0;
                      const aprobado = promedioModulo >= 7;

                      return (
                        <View style={[styles.dataCell, styles.promedioCell, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)', borderColor: theme.border }]}>
                          <View style={[styles.gradeBadge, { backgroundColor: aprobado ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                            <Text style={[styles.gradeText, styles.promedioText, { color: aprobado ? theme.green : theme.red }]}>
                              {promedioModulo > 0 ? promedioModulo.toFixed(2) : '-'}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Si está en vista "todos", mostrar promedios por módulo */}
                    {moduloActivo === 'todos' && modulos.map((modulo, idx) => {
                      const moduloDetalle = estudiante.modulos_detalle?.find(m => m.nombre_modulo === modulo);
                      const promedioModulo = moduloDetalle ? parseFloat(String(moduloDetalle.promedio_modulo_sobre_10)) : 0;
                      const aprobado = promedioModulo >= 7;

                      return (
                        <View key={`modulo-${idx}`} style={[styles.dataCell, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)', borderColor: theme.border }]}>
                          <View style={[styles.gradeBadge, { backgroundColor: aprobado ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                            <Text style={[styles.gradeText, { color: aprobado ? theme.green : theme.red }]}>
                              {promedioModulo > 0 ? promedioModulo.toFixed(2) : '-'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Promedio global (solo en vista "todos") */}
                    {moduloActivo === 'todos' && (
                      <View style={[styles.dataCell, styles.globalCell, { backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.05)' : 'rgba(96, 165, 250, 0.02)', borderColor: theme.border }]}>
                        <View style={[styles.gradeBadge, { backgroundColor: aprobadoGlobal ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                          <Text style={[styles.gradeText, styles.globalText, { color: aprobadoGlobal ? theme.green : theme.red }]}>
                            {promedioGlobal.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </ScrollView>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#fff',
    fontSize: 9,
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
    borderBottomWidth: 1,
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
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerContainer: {
    flex: 1,
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
  // Estilos de tabla
  tableContainer: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  stickyColumn: {
    width: 150,
    padding: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  scrollableColumns: {
    flex: 1,
  },
  headerCell: {
    width: 100,
    padding: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promedioHeader: {
    width: 120,
  },
  globalHeader: {
    width: 120,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSubtext: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  studentCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 10,
  },
  dataCell: {
    width: 100,
    padding: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promedioCell: {
    width: 120,
  },
  globalCell: {
    width: 120,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  promedioText: {
    fontSize: 14,
  },
  globalText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
