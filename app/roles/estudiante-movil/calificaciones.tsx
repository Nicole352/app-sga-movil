import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre: string;
  calificacion: number;
  progreso: number;
}

interface Calificacion {
  id_calificacion: number;
  id_tarea: number;
  id_modulo?: number;
  tarea_titulo: string;
  nota: number | null;
  nota_maxima: number;
  ponderacion?: number;
  fecha_calificacion: string;
  comentario_docente: string;
  modulo_nombre: string;
  modulo_orden: number;
  resultado: string;
  categoria_nombre?: string;
  categoria_ponderacion?: number;
  fecha_entrega?: string | null;
  fecha_limite?: string;
}

interface ModuloConPromedio {
  id_modulo: number;
  nombre: string;
  orden: number;
  promedio_ponderado: number;
  total_tareas: number;
  tareas_calificadas: number;
  promedios_publicados: boolean;
  calificaciones: Calificacion[];
}

interface PromedioGlobal {
  promedio_global: number;
  peso_por_modulo: number;
  total_modulos: number;
}

interface CalificacionesPorCurso {
  curso: Curso;
  calificaciones: Calificacion[];
  promedio: number;
  modulos: ModuloConPromedio[];
}

export default function CalificacionesEstudiante() {
  const [darkMode, setDarkMode] = useState(false);
  const [cursosConCalificaciones, setCursosConCalificaciones] = useState<CalificacionesPorCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCursos, setExpandedCursos] = useState<Record<number, boolean>>({});
  const [expandedModulos, setExpandedModulos] = useState<Record<string, boolean>>({});
  const [promediosGlobales, setPromediosGlobales] = useState<Record<number, PromedioGlobal>>({});
  const [loadingPromedioGlobal, setLoadingPromedioGlobal] = useState<Record<number, boolean>>({});
  const [userData, setUserData] = useState<any>(null);

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: '#141414',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    accent: '#f59e0b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    blue: '#3b82f6',
    gray: '#6b7280',
    cardGradientStart: '#141414',
    cardGradientEnd: '#141414',
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
    danger: '#dc2626',
    blue: '#2563eb',
    gray: '#9ca3af',
    cardGradientStart: '#ffffff',
    cardGradientEnd: '#f8fafc',
  };

  useEffect(() => {
    const loadInitData = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) setDarkMode(savedMode === 'true');
      const user = await getUserData();
      setUserData(user);
      await fetchCalificaciones();
    };
    loadInitData();

    eventEmitter.on('themeChanged', (isDark: boolean) => setDarkMode(isDark));
  }, []);

  const socketEvents = {
    'calificacion_actualizada': () => fetchCalificaciones(),
    'tarea_calificada': () => fetchCalificaciones(),
    'promedio_actualizado': () => fetchCalificaciones(),
    'promedios_visibilidad_actualizada': () => fetchCalificaciones()
  };

  useSocket(socketEvents, userData?.id_usuario);

  const fetchCalificaciones = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const cursosResponse = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!cursosResponse.ok) return;

      const cursos: Curso[] = await cursosResponse.json();
      const cursosConCalificacionesData: CalificacionesPorCurso[] = [];

      for (const curso of cursos) {
        try {
          const calificacionesResponse = await fetch(
            `${API_URL}/calificaciones/estudiante/curso/${curso.id_curso}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (calificacionesResponse.ok) {
            const data = await calificacionesResponse.json();
            const calificaciones = Array.isArray(data.calificaciones) ? data.calificaciones : [];
            const resumen = data.resumen || {};
            const promedio = Number(resumen.promedio_global || 0);

            let modulos: ModuloConPromedio[] = [];
            if (resumen.desglose_modulos && Array.isArray(resumen.desglose_modulos)) {
              modulos = resumen.desglose_modulos.map((m: any) => ({
                id_modulo: m.id_modulo,
                nombre: m.nombre_modulo,
                orden: m.id_modulo,
                promedio_ponderado: Number(m.promedio_modulo_sobre_10 || 0),
                total_tareas: m.total_tareas,
                tareas_calificadas: m.total_tareas,
                promedios_publicados: true,
                calificaciones: calificaciones.filter((c: any) => c.modulo_nombre === m.nombre_modulo)
              }));
            } else {
              modulos = agruparPorModulo(calificaciones);
            }

            cursosConCalificacionesData.push({ curso, calificaciones, promedio, modulos });

            if (resumen.promedio_global === undefined) {
              fetchPromedioGlobal(curso.id_curso);
            }
          }
        } catch (error) {
          console.error(`Error loading grades for course ${curso.id_curso}`, error);
        }
      }
      setCursosConCalificaciones(cursosConCalificacionesData);
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPromedioGlobal = async (cursoId: number) => {
    setLoadingPromedioGlobal(prev => ({ ...prev, [cursoId]: true }));
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/calificaciones/promedio-global/${cursoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.visible && data.promedio_global) {
          setPromediosGlobales(prev => ({ ...prev, [cursoId]: data.promedio_global }));
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingPromedioGlobal(prev => ({ ...prev, [cursoId]: false })); }
  };

  const agruparPorModulo = (calificaciones: Calificacion[]): ModuloConPromedio[] => {
    const modulosMap = new Map<number, ModuloConPromedio>();
    calificaciones.forEach((cal) => {
      const idModulo = cal.id_modulo || 0;
      if (!modulosMap.has(idModulo)) {
        modulosMap.set(idModulo, {
          id_modulo: idModulo,
          nombre: cal.modulo_nombre,
          orden: cal.modulo_orden,
          promedio_ponderado: 0,
          total_tareas: 0,
          tareas_calificadas: 0,
          promedios_publicados: (cal as any).promedios_publicados || false,
          calificaciones: [],
        });
      }
      const modulo = modulosMap.get(idModulo)!;
      modulo.calificaciones.push(cal);
      modulo.tareas_calificadas++;
    });

    modulosMap.forEach((modulo) => {
      const aportes = modulo.calificaciones.map((cal) => {
        const nota = Number(cal.nota || 0);
        const max = Number(cal.nota_maxima || 10);
        const pond = Number(cal.ponderacion || 1);
        return (nota / max) * pond;
      });
      modulo.promedio_ponderado = aportes.reduce((a, b) => a + b, 0);
    });

    return Array.from(modulosMap.values()).sort((a, b) => a.orden - b.orden);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalificaciones();
  };

  const toggleCurso = (id: number) => {
    setExpandedCursos(prev => {
      const isOpen = !prev[id];
      if (isOpen && !promediosGlobales[id]) fetchPromedioGlobal(id);
      return { ...prev, [id]: isOpen };
    });
  };

  const toggleModulo = (cursoId: number, moduloId: number) => {
    setExpandedModulos(prev => ({ ...prev, [`${cursoId}-${moduloId}`]: !prev[`${cursoId}-${moduloId}`] }));
  };

  const getColorByGrade = (grade: number) => {
    if (grade >= 9) return theme.success;
    if (grade >= 7) return theme.warning;
    return theme.danger;
  };

  const getGradeLabel = (grade: number) => {
    if (grade >= 9) return 'Excelente';
    if (grade >= 8) return 'Muy Bueno';
    if (grade >= 7) return 'Aprobado';
    if (grade >= 5) return 'Regular';
    return 'Insuficiente';
  };

  const getGradientColors = (grade: number, isHeader = false) => {
    if (isHeader) {
      return darkMode
        ? ['rgba(251, 191, 36, 0.1)', 'rgba(0,0,0,0)'] as const
        : ['rgba(251, 191, 36, 0.15)', 'rgba(255,255,255,0)'] as const;
    }
    return darkMode
      ? ['#141414', '#141414'] as const
      : ['#ffffff', '#f8fafc'] as const;
  };

  const groupTasksByCategory = (tasks: Calificacion[]) => {
    const groups = tasks.reduce((acc, task) => {
      const key = task.categoria_nombre
        ? `${task.categoria_nombre}|${task.categoria_ponderacion}`
        : 'Sin Categoría|0';
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, Calificacion[]>);
    return groups;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const totalCursos = cursosConCalificaciones.length;
  const totalTareas = cursosConCalificaciones.reduce((acc, c) => acc + c.calificaciones.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
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
              <Text style={[styles.headerTitle, { color: theme.text }]}>Calificaciones</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Rendimiento Académico</Text>
            </View>
            <View style={[styles.headerIconContainer, { backgroundColor: theme.accent + '15' }]}>
              <Ionicons name="ribbon" size={24} color={theme.accent} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {/* Stats Header */}
        {totalCursos > 0 && (
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: `${theme.blue}15`, borderColor: `${theme.blue}30` }]}>
              <Ionicons name="book-outline" size={14} color={theme.blue} />
              <Text style={styles.statLabel}>Cursos</Text>
              <Text style={[styles.statValue, { color: theme.blue }]}>{totalCursos}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}30` }]}>
              <Ionicons name="documents-outline" size={14} color={theme.accent} />
              <Text style={styles.statLabel}>Tareas</Text>
              <Text style={[styles.statValue, { color: theme.accent }]}>{totalTareas}</Text>
            </View>
          </View>
        )}

        {cursosConCalificaciones.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.cardBg }]}>
            <Ionicons name="trophy-outline" size={48} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin Calificaciones</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Tus notas aparecerán aquí cuando tus entregas sean calificadas.
            </Text>
          </View>
        ) : (
          cursosConCalificaciones.map((item, index) => {
            const { curso, promedio, modulos } = item;
            const isExpanded = expandedCursos[curso.id_curso];
            const gradeColor = modulos.every(m => m.promedios_publicados) ? getColorByGrade(promedio) : theme.textMuted;

            return (
              <Animated.View
                key={curso.id_curso}
                entering={FadeInDown.delay(100 * index).duration(400)}
                style={[styles.cardContainer, { shadowColor: theme.text }]}
              >
                <LinearGradient
                  colors={darkMode ? ['#141414', '#141414'] : ['#ffffff', '#f8fafc']}
                  style={[styles.card, { borderColor: theme.border }]}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleCurso(curso.id_curso)}
                  >
                    <LinearGradient
                      colors={getGradientColors(0, true)}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.cardHeaderStrip}
                    />
                    <View style={styles.cardHeader}>
                      <View style={styles.headerLeft}>
                        <View style={styles.courseBadge}>
                          <Text style={styles.courseBadgeText}>{curso.codigo_curso}</Text>
                        </View>
                        <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={1}>
                          {curso.nombre}
                        </Text>
                      </View>
                      <View style={styles.headerRight}>
                        <View style={styles.gradeContainer}>
                          <Text style={[styles.gradeValue, { color: gradeColor }]}>
                            {modulos.every(m => m.promedios_publicados) ? promedio.toFixed(2) : 'Parcial'}
                          </Text>
                          <Text style={[styles.gradeLabel, { color: theme.textMuted }]}>
                            {modulos.every(m => m.promedios_publicados) ? getGradeLabel(promedio) : 'Oculto'}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.detailsContainer}>
                      {/* Global Avg Card */}
                      {promediosGlobales[curso.id_curso] && (
                        <View style={[styles.globalAvgCard, { backgroundColor: `${theme.accent}10`, borderColor: `${theme.accent}30` }]}>
                          <View style={styles.globalAvgRow}>
                            <Ionicons name="analytics" size={14} color={theme.accent} />
                            <Text style={[styles.globalAvgTitle, { color: theme.accent }]}>PROMEDIO GLOBAL</Text>
                          </View>
                          <Text style={[styles.globalAvgValue, { color: gradeColor }]}>
                            {promediosGlobales[curso.id_curso].promedio_global.toFixed(2)}
                            <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '400' }}> / 10</Text>
                          </Text>
                        </View>
                      )}

                      {modulos.map(modulo => {
                        const isModExpanded = expandedModulos[`${curso.id_curso}-${modulo.id_modulo}`];
                        const modGradeColor = getColorByGrade(modulo.promedio_ponderado);

                        // Group tasks
                        const taskGroups = groupTasksByCategory(modulo.calificaciones);
                        const groupKeys = Object.keys(taskGroups);

                        return (
                          <View key={modulo.id_modulo} style={[styles.moduleContainer, { backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(241, 245, 249, 0.5)', borderColor: theme.border }]}>
                            <TouchableOpacity
                              style={styles.moduleHeader}
                              onPress={() => toggleModulo(curso.id_curso, modulo.id_modulo)}
                            >
                              <View style={styles.moduleInfo}>
                                <Text style={[styles.moduleName, { color: theme.text }]} numberOfLines={1}>{modulo.nombre}</Text>
                                <Text style={[styles.moduleCount, { color: theme.textMuted }]}>
                                  {modulo.tareas_calificadas} {modulo.tareas_calificadas === 1 ? 'tarea' : 'tareas'}
                                </Text>
                              </View>
                              {modulo.promedios_publicados ? (
                                <View style={styles.moduleGradeBox}>
                                  <Text style={[styles.moduleGrade, { color: modGradeColor }]}>
                                    {modulo.promedio_ponderado.toFixed(2)}
                                  </Text>
                                  <Ionicons name={isModExpanded ? "chevron-up" : "chevron-down"} size={12} color={theme.textMuted} />
                                </View>
                              ) : (
                                <View style={[styles.hiddenBadge, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                  <Text style={[styles.hiddenText, { color: theme.textMuted }]}>Oculto</Text>
                                </View>
                              )}
                            </TouchableOpacity>

                            {isModExpanded && (
                              <View style={styles.tasksList}>
                                {groupKeys.map(key => {
                                  const [catName, catWeight] = key.split('|');
                                  const tasks = taskGroups[key];

                                  return (
                                    <View key={key} style={styles.categoryGroup}>
                                      {catName !== 'Sin Categoría' && (
                                        <View style={styles.categoryHeader}>
                                          <Ionicons name="pricetag-outline" size={12} color={theme.accent} />
                                          <Text style={[styles.categoryTitle, { color: theme.text }]}>
                                            {catName} <Text style={{ color: theme.textMuted, fontWeight: '400' }}>({catWeight} pts)</Text>
                                          </Text>
                                        </View>
                                      )}

                                      {tasks.map((cal, calIdx) => {
                                        const nota = cal.nota !== null ? Number(cal.nota) : null;
                                        const max = Number(cal.nota_maxima || 10);

                                        const fechaLimite = cal.fecha_limite ? new Date(cal.fecha_limite) : null;
                                        const fechaEntrega = cal.fecha_entrega ? new Date(cal.fecha_entrega) : null;
                                        const fueEntregada = !!cal.fecha_entrega;
                                        const fechaActual = new Date();
                                        const estaVencida = !fueEntregada && fechaLimite && fechaActual > fechaLimite;
                                        const esEntregaTardia = fueEntregada && fechaLimite && fechaEntrega && fechaEntrega > fechaLimite;

                                        return (
                                          <View key={cal.id_calificacion || cal.id_tarea || `task-${calIdx}`} style={[styles.taskItem, { borderLeftColor: nota !== null ? getColorByGrade((nota / max) * 10) : theme.border }]}>
                                            <View style={styles.taskHeader}>
                                              <Text style={[styles.taskTitle, { color: theme.textSecondary }]}>{cal.tarea_titulo}</Text>
                                              <Text style={[styles.taskDate, { color: theme.textMuted }]}>
                                                {nota !== null && cal.fecha_calificacion
                                                  ? `Calificado: ${new Date(cal.fecha_calificacion).toLocaleDateString()}`
                                                  : cal.fecha_limite
                                                    ? `Vence: ${new Date(cal.fecha_limite).toLocaleDateString()}`
                                                    : 'Sin fecha límite'
                                                }
                                              </Text>
                                            </View>

                                            <View style={styles.taskFooter}>
                                              {/* STATUS LOGIC COMPATIBLE CON WEB */}
                                              {nota !== null ? (
                                                // Tiene Nota
                                                <View style={styles.taskGradeBadge}>
                                                  <Text style={[styles.taskGrade, { color: getColorByGrade((nota / max) * 10) }]}>
                                                    {nota.toFixed(1)}
                                                  </Text>
                                                  <Text style={[styles.taskMax, { color: theme.textMuted }]}>/{max}</Text>
                                                </View>
                                              ) : fueEntregada ? (
                                                esEntregaTardia ? (
                                                  // Tardía
                                                  <View style={[styles.statusBadge, { backgroundColor: `${theme.warning}20`, borderColor: `${theme.warning}40` }]}>
                                                    <Ionicons name="alert-circle-outline" size={12} color={theme.warning} />
                                                    <Text style={[styles.statusText, { color: theme.warning }]}>Entregada con Retraso</Text>
                                                  </View>
                                                ) : (
                                                  // Pendiente Calificar
                                                  <View style={[styles.statusBadge, { backgroundColor: `${theme.blue}20`, borderColor: `${theme.blue}40` }]}>
                                                    <Ionicons name="time-outline" size={12} color={theme.blue} />
                                                    <Text style={[styles.statusText, { color: theme.blue }]}>Pendiente de Calificar</Text>
                                                  </View>
                                                )
                                              ) : estaVencida ? (
                                                // Vencida
                                                <View style={[styles.statusBadge, { backgroundColor: `${theme.danger}20`, borderColor: `${theme.danger}40` }]}>
                                                  <Ionicons name="alert-circle-outline" size={12} color={theme.danger} />
                                                  <Text style={[styles.statusText, { color: theme.danger }]}>No Entregada / Vencida</Text>
                                                </View>
                                              ) : (
                                                // Pendiente Entrega
                                                <View style={[styles.statusBadge, { backgroundColor: `${theme.gray}20`, borderColor: `${theme.gray}40` }]}>
                                                  <Ionicons name="hourglass-outline" size={12} color={theme.gray} />
                                                  <Text style={[styles.statusText, { color: theme.gray }]}>Pendiente de Entrega</Text>
                                                </View>
                                              )}


                                            </View>

                                            {cal.comentario_docente && (
                                              <Text style={[styles.taskComment, { color: theme.textMuted }]}>
                                                "{cal.comentario_docente}"
                                              </Text>
                                            )}
                                          </View>
                                        );
                                      })}
                                    </View>
                                  )
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },

  // Stats
  statsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '700' },

  // Empty State
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Cards
  cardContainer: { marginBottom: 16, borderRadius: 16, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeaderStrip: { height: 4, width: '100%' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerLeft: { flex: 1, gap: 6 },
  courseBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  courseBadgeText: { color: '#6366f1', fontSize: 9, fontWeight: '600' },
  courseTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },

  headerRight: { alignItems: 'flex-end', gap: 8, flexDirection: 'row' },
  gradeContainer: { alignItems: 'flex-end' },
  gradeValue: { fontSize: 16, fontWeight: '700' },
  gradeLabel: { fontSize: 9, fontWeight: '500' },

  // Details
  detailsContainer: { padding: 16, paddingTop: 0, gap: 12 },

  globalAvgCard: { padding: 12, borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  globalAvgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  globalAvgTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  globalAvgValue: { fontSize: 16, fontWeight: '800' },

  moduleContainer: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  moduleInfo: { flex: 1, gap: 2 },
  moduleName: { fontSize: 13, fontWeight: '600' },
  moduleCount: { fontSize: 10 },

  moduleGradeBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moduleGrade: { fontSize: 13, fontWeight: '700' },
  hiddenBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  hiddenText: { fontSize: 10, fontStyle: 'italic' },

  tasksList: { padding: 12, paddingTop: 0, gap: 8 }, // increased gap

  // Category Group
  categoryGroup: { gap: 6, marginBottom: 8 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.9, marginTop: 4, marginBottom: 2 },
  categoryTitle: { fontSize: 11, fontWeight: '700' },

  taskItem: { padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderLeftWidth: 3 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  taskTitle: { flex: 1, fontSize: 12, fontWeight: '600', marginRight: 8 },
  taskDate: { fontSize: 9 },

  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  taskGradeBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  taskGrade: { fontSize: 13, fontWeight: '700' },
  taskMax: { fontSize: 10 },
  taskWeight: { fontSize: 9, fontStyle: 'italic' },
  taskComment: { fontSize: 10, fontStyle: 'italic', marginTop: 6, opacity: 0.8 },

  // Status Badges
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 9, fontWeight: '600' },
});
