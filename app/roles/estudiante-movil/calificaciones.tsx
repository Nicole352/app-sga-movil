import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
  nota: number;
  nota_maxima: number;
  ponderacion?: number;
  fecha_calificacion: string;
  comentario_docente: string;
  modulo_nombre: string;
  modulo_orden: number;
  resultado: string;
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

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };

    const loadUserData = async () => {
      const user = await getUserData();
      setUserData(user);
    };

    loadDarkMode();
    loadUserData();
    fetchCalificaciones();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  // Configurar eventos de WebSocket para actualizaciones en tiempo real
  const socketEvents = {
    'calificacion_actualizada': (data: any) => {
      console.log('Nueva calificación disponible');
      fetchCalificaciones();
    },
    'tarea_calificada': (data: any) => {
      console.log('Tarea calificada');
      fetchCalificaciones();
    }
  };

  useSocket(socketEvents, userData?.id_usuario);

  const fetchCalificaciones = async () => {
    try {
      const token = await getToken();

      // Obtener cursos
      const cursosResponse = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!cursosResponse.ok) return;

      const cursos: Curso[] = await cursosResponse.json();
      const cursosConCalificacionesData: CalificacionesPorCurso[] = [];

      // Obtener calificaciones por curso
      for (const curso of cursos) {
        try {
          const calificacionesResponse = await fetch(
            `${API_URL}/calificaciones/estudiante/curso/${curso.id_curso}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (calificacionesResponse.ok) {
            const calificacionesData = await calificacionesResponse.json();
            const calificaciones = Array.isArray(calificacionesData.calificaciones)
              ? calificacionesData.calificaciones
              : [];

            const resumen = calificacionesData.resumen || {};
            const promedio = resumen.promedio_global !== undefined
              ? parseFloat(resumen.promedio_global)
              : 0;

            // Usar el desglose de módulos del backend
            let modulos: ModuloConPromedio[] = [];

            if (resumen.desglose_modulos && Array.isArray(resumen.desglose_modulos)) {
              modulos = resumen.desglose_modulos.map((m: any) => {
                const tareasModulo = calificaciones.filter((c: any) => c.modulo_nombre === m.nombre_modulo);
                return {
                  id_modulo: m.id_modulo,
                  nombre: m.nombre_modulo,
                  orden: m.id_modulo,
                  promedio_ponderado: parseFloat(m.promedio_modulo_sobre_10),
                  total_tareas: m.total_tareas,
                  tareas_calificadas: m.total_tareas,
                  promedios_publicados: true,
                  calificaciones: tareasModulo
                };
              });
            } else {
              modulos = agruparPorModulo(calificaciones);
            }

            cursosConCalificacionesData.push({
              curso,
              calificaciones,
              promedio,
              modulos
            });
          }
        } catch (error) {
          console.error(`Error cargando calificaciones para curso ${curso.id_curso}:`, error);
        }
      }

      setCursosConCalificaciones(cursosConCalificacionesData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalificaciones();
  };

  const toggleCurso = async (cursoId: number) => {
    const isExpanding = !expandedCursos[cursoId];

    setExpandedCursos(prev => ({
      ...prev,
      [cursoId]: !prev[cursoId]
    }));

    // Si se está expandiendo y no tenemos el promedio global, lo cargamos
    if (isExpanding && !promediosGlobales[cursoId]) {
      await fetchPromedioGlobal(cursoId);
    }
  };

  const toggleModulo = (cursoId: number, moduloId: number) => {
    const key = `${cursoId}-${moduloId}`;
    setExpandedModulos(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const fetchPromedioGlobal = async (cursoId: number) => {
    setLoadingPromedioGlobal(prev => ({ ...prev, [cursoId]: true }));

    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/calificaciones/promedio-global/${cursoId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.visible && data.promedio_global) {
          setPromediosGlobales(prev => ({
            ...prev,
            [cursoId]: data.promedio_global
          }));
        }
      }
    } catch (error) {
      console.error('Error cargando promedio global:', error);
    } finally {
      setLoadingPromedioGlobal(prev => ({ ...prev, [cursoId]: false }));
    }
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
        const nota = parseFloat(cal.nota as any) || 0;
        const notaMaxima = parseFloat(cal.nota_maxima as any) || 10;
        const ponderacion = cal.ponderacion || 1;
        return (nota / notaMaxima) * ponderacion;
      });

      modulo.promedio_ponderado = aportes.reduce((sum, aporte) => sum + aporte, 0);
    });

    return Array.from(modulosMap.values()).sort((a, b) => a.orden - b.orden);
  };

  const getColorByGrade = (grade: number) => {
    if (grade >= 9) return '#10b981';
    if (grade >= 7) return '#f59e0b';
    return '#ef4444';
  };

  const getColorByGrade10 = (grade: number) => {
    if (grade >= 9) return '#10b981';
    if (grade >= 7) return '#f59e0b';
    return '#ef4444';
  };

  const getGradeLabel = (grade: number) => {
    if (grade >= 9) return 'Excelente';
    if (grade >= 8) return 'Muy Bueno';
    if (grade >= 7) return 'Aprobado';
    if (grade >= 5) return 'Regular';
    return 'Insuficiente';
  };

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    border: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    accent: '#fbbf24',
  };

  const totalCursos = cursosConCalificaciones.length;
  const totalTareas = cursosConCalificaciones.reduce((sum, c) => sum + c.calificaciones.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mis Calificaciones</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Revisa tu rendimiento académico
          </Text>
        </View>

        {/* Estadísticas */}
        {totalCursos > 0 && (
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
              <Ionicons name="book" size={14} color="#3b82f6" />
              <Text style={styles.statLabel}>Cursos</Text>
              <Text style={[styles.statValue, { color: '#3b82f6' }]}>{totalCursos}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
              <Ionicons name="clipboard" size={14} color="#f59e0b" />
              <Text style={styles.statLabel}>Tareas</Text>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>{totalTareas}</Text>
            </View>
          </View>
        )}

        {/* Cursos */}
        <View style={styles.section}>
          {loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando calificaciones...</Text>
            </View>
          ) : cursosConCalificaciones.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="trophy-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no tienes calificaciones</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Tus calificaciones aparecerán aquí una vez que tus docentes evalúen tus entregas
              </Text>
            </View>
          ) : (
            cursosConCalificaciones.map(({ curso, calificaciones, promedio, modulos }) => (
              <View key={curso.id_curso} style={[styles.cursoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => toggleCurso(curso.id_curso)}
                  style={styles.cursoHeader}
                  activeOpacity={0.7}
                >
                  <View style={styles.cursoInfo}>
                    <View style={styles.cursoBadge}>
                      <Text style={styles.cursoBadgeText}>{curso.codigo_curso}</Text>
                    </View>
                    <Text style={[styles.cursoNombre, { color: colors.text }]} numberOfLines={2}>
                      {curso.nombre}
                    </Text>
                  </View>

                  <View style={styles.cursoStats}>
                    <Text style={[styles.promedio, { color: modulos.every(m => m.promedios_publicados) ? getColorByGrade(promedio) : colors.textSecondary }]}>
                      {modulos.every(m => m.promedios_publicados) ? (promedio || 0).toFixed(1) : 'Parcial'}
                    </Text>
                    <Text style={[styles.promedioLabel, { color: colors.textSecondary }]}>
                      {modulos.every(m => m.promedios_publicados) ? getGradeLabel(promedio) : 'Ocultos'}
                    </Text>
                    <Ionicons
                      name={expandedCursos[curso.id_curso] ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {expandedCursos[curso.id_curso] && (
                  <View style={styles.calificacionesContainer}>
                    {/* Promedio Global */}
                    {promediosGlobales[curso.id_curso] && (
                      <View style={[styles.promedioGlobalCard, { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)', borderColor: colors.accent }]}>
                        <View style={styles.promedioGlobalHeader}>
                          <View style={styles.promedioGlobalInfo}>
                            <View style={styles.promedioGlobalTitleRow}>
                              <Ionicons name="trending-up" size={14} color={colors.accent} />
                              <Text style={[styles.promedioGlobalTitle, { color: colors.accent }]}>
                                Promedio Global del Curso
                              </Text>
                            </View>
                            <Text style={[styles.promedioGlobalSubtitle, { color: colors.textSecondary }]}>
                              Sobre 10 puntos • Cada módulo aporta {promediosGlobales[curso.id_curso].peso_por_modulo?.toFixed(2) || '0.00'} puntos
                            </Text>
                            <Text style={[styles.promedioGlobalModulos, { color: colors.textSecondary }]}>
                              {promediosGlobales[curso.id_curso].total_modulos || 0} módulos con calificaciones
                            </Text>
                          </View>
                          <View style={styles.promedioGlobalValue}>
                            <Text style={[styles.promedioGlobalNumber, { color: getColorByGrade10(promediosGlobales[curso.id_curso].promedio_global || 0) }]}>
                              {(promediosGlobales[curso.id_curso].promedio_global || 0).toFixed(2)}
                            </Text>
                            <Text style={[styles.promedioGlobalMax, { color: colors.textSecondary }]}>
                              / 10 puntos
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {loadingPromedioGlobal[curso.id_curso] && !promediosGlobales[curso.id_curso] && (
                      <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                          Calculando promedio global...
                        </Text>
                      </View>
                    )}

                    {/* Promedios por Módulo */}
                    {modulos.filter(m => m.promedios_publicados).length > 0 && (
                      <View style={styles.modulosPromedioSection}>
                        <View style={styles.modulosPromedioHeader}>
                          <Ionicons name="bar-chart" size={14} color={colors.accent} />
                          <Text style={[styles.modulosPromedioTitle, { color: colors.text }]}>
                            PROMEDIOS POR MÓDULO
                          </Text>
                        </View>
                        {modulos.filter(m => m.promedios_publicados).map((modulo) => (
                          <View key={modulo.id_modulo} style={[styles.moduloPromedioCard, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', borderColor: `${getColorByGrade10(modulo.promedio_ponderado)}40` }]}>
                            <View style={styles.moduloPromedioInfo}>
                              <Text style={[styles.moduloPromedioNombre, { color: colors.text }]}>
                                {modulo.nombre}
                              </Text>
                              <Text style={[styles.moduloPromedioTareas, { color: colors.textSecondary }]}>
                                {modulo.tareas_calificadas} {modulo.tareas_calificadas === 1 ? 'tarea calificada' : 'tareas calificadas'}
                              </Text>
                            </View>
                            <View style={styles.moduloPromedioValue}>
                              <Text style={[styles.moduloPromedioNumber, { color: getColorByGrade10(modulo.promedio_ponderado || 0) }]}>
                                {(modulo.promedio_ponderado || 0).toFixed(2)}
                              </Text>
                              <Text style={[styles.moduloPromedioLabel, { color: colors.textSecondary }]}>
                                Promedio
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {calificaciones.length === 0 ? (
                      <View style={[styles.emptyModuloCard, { backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)', borderColor: `${colors.accent}30` }]}>
                        <Ionicons name="trophy" size={28} color={colors.accent} />
                        <Text style={[styles.emptyModuloTitle, { color: colors.text }]}>
                          Sin calificaciones aún
                        </Text>
                        <Text style={[styles.emptyModuloText, { color: colors.textSecondary }]}>
                          Completa y entrega tus tareas para recibir calificaciones
                        </Text>
                      </View>
                    ) : (
                      modulos.map((modulo) => {
                        const moduloKey = `${curso.id_curso}-${modulo.id_modulo}`;
                        const isModuloExpanded = expandedModulos[moduloKey] || false;

                        return (
                          <View key={modulo.id_modulo} style={[styles.moduloCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }]}>
                            <TouchableOpacity
                              onPress={() => toggleModulo(curso.id_curso, modulo.id_modulo)}
                              style={[styles.moduloHeader, { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.05)', borderBottomWidth: isModuloExpanded ? 1 : 0, borderBottomColor: colors.border }]}
                              activeOpacity={0.7}
                            >
                              <View style={styles.moduloHeaderLeft}>
                                <Ionicons
                                  name={isModuloExpanded ? 'chevron-down' : 'chevron-forward'}
                                  size={16}
                                  color={colors.accent}
                                />
                                <View style={styles.moduloHeaderInfo}>
                                  <Text style={[styles.moduloNombre, { color: colors.text }]}>
                                    {modulo.nombre}
                                  </Text>
                                  <Text style={[styles.moduloTareas, { color: colors.textSecondary }]}>
                                    {modulo.tareas_calificadas} {modulo.tareas_calificadas === 1 ? 'tarea calificada' : 'tareas calificadas'}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.moduloHeaderRight}>
                                {modulo.promedios_publicados ? (
                                  <>
                                    <Text style={[styles.moduloPromedio, { color: getColorByGrade10(modulo.promedio_ponderado || 0) }]}>
                                      {(modulo.promedio_ponderado || 0).toFixed(2)}
                                    </Text>
                                    <Text style={[styles.moduloPromedioLabelSmall, { color: colors.textSecondary }]}>
                                      Promedio
                                    </Text>
                                  </>
                                ) : (
                                  <View style={styles.moduloOcultoContainer}>
                                    <View style={[styles.moduloOcultoBadge, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                      <Text style={[styles.moduloOcultoText, { color: colors.textSecondary }]}>
                                        Oculto
                                      </Text>
                                    </View>
                                    <Text style={[styles.moduloOcultoSubtext, { color: colors.textSecondary }]}>
                                      Por el docente
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>

                            {isModuloExpanded && (
                              <View style={styles.tareasModuloContainer}>
                                {modulo.calificaciones.map((cal) => (
                                  <View key={cal.id_calificacion} style={[styles.tareaCalificacionCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.5)', borderColor: colors.border }]}>
                                    <View style={styles.tareaCalificacionHeader}>
                                      <Text style={[styles.tareaCalificacionTitle, { color: colors.text }]} numberOfLines={2}>
                                        {cal.tarea_titulo}
                                      </Text>
                                      <View style={[styles.tareaNotaBadge, { backgroundColor: `${getColorByGrade(Number(cal.nota) || 0)}20`, borderColor: `${getColorByGrade(Number(cal.nota) || 0)}30` }]}>
                                        <Text style={[styles.tareaNotaText, { color: getColorByGrade(Number(cal.nota) || 0) }]}>
                                          {(Number(cal.nota) || 0).toFixed(1)}
                                        </Text>
                                        <Text style={[styles.tareaNotaMax, { color: colors.textSecondary }]}>
                                          /{cal.nota_maxima}
                                        </Text>
                                        {cal.ponderacion && (
                                          <Text style={[styles.tareaPonderacion, { color: colors.textSecondary, borderLeftColor: colors.border }]}>
                                            Peso: {cal.ponderacion}pts
                                          </Text>
                                        )}
                                      </View>
                                    </View>

                                    {cal.comentario_docente && (
                                      <View style={[styles.tareaComentario, { backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', borderColor: colors.border }]}>
                                        <Text style={[styles.tareaComentarioText, { color: colors.textSecondary }]}>
                                          "{cal.comentario_docente}"
                                        </Text>
                                      </View>
                                    )}

                                    <View style={[styles.tareaCalificacionFooter, { borderTopColor: colors.border }]}>
                                      <View style={styles.tareaFechaContainer}>
                                        <Ionicons name="calendar" size={12} color={colors.textSecondary} />
                                        <Text style={[styles.tareaFechaText, { color: colors.textSecondary }]}>
                                          {new Date(cal.fecha_calificacion).toLocaleDateString('es-ES')}
                                        </Text>
                                      </View>
                                      <View style={[styles.tareaResultadoBadge, { backgroundColor: `${getColorByGrade(((Number(cal.nota) / Number(cal.nota_maxima)) * 10))}20` }]}>
                                        <Text style={[styles.tareaResultadoText, { color: getColorByGrade(((Number(cal.nota) / Number(cal.nota_maxima)) * 10)) }]}>
                                          {getGradeLabel(((Number(cal.nota) / Number(cal.nota_maxima)) * 10))}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 4,
    gap: 6,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  statLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  section: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  cursoCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cursoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  cursoInfo: {
    flex: 1,
    gap: 6,
  },
  cursoBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  cursoBadgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '700',
  },
  cursoNombre: {
    fontSize: 13,
    fontWeight: '700',
  },
  cursoStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  promedio: {
    fontSize: 16,
    fontWeight: '800',
  },
  promedioLabel: {
    fontSize: 9,
    marginBottom: 3,
  },
  calificacionesContainer: {
    padding: 12,
    paddingTop: 0,
    gap: 10,
  },
  noCalificaciones: {
    textAlign: 'center',
    padding: 16,
    fontSize: 12,
  },
  calificacionCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  calificacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  tareaTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  notaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  notaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calificacionDetails: {
    gap: 5,
  },
  calificacionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    fontSize: 10,
  },
  comentario: {
    padding: 8,
    borderRadius: 6,
    gap: 3,
  },
  comentarioLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  comentarioText: {
    fontSize: 10,
    lineHeight: 15,
  },
  promedioGlobalCard: {
    borderRadius: 10,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
  },
  promedioGlobalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promedioGlobalInfo: {
    flex: 1,
    gap: 3,
  },
  promedioGlobalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promedioGlobalTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promedioGlobalSubtitle: {
    fontSize: 9,
  },
  promedioGlobalModulos: {
    fontSize: 8,
    fontStyle: 'italic',
  },
  promedioGlobalValue: {
    alignItems: 'flex-end',
  },
  promedioGlobalNumber: {
    fontSize: 20,
    fontWeight: '900',
  },
  promedioGlobalMax: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },
  loadingCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 10,
  },
  modulosPromedioSection: {
    marginBottom: 10,
  },
  modulosPromedioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  modulosPromedioTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moduloPromedioCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduloPromedioInfo: {
    flex: 1,
  },
  moduloPromedioNombre: {
    fontSize: 11,
    fontWeight: '600',
  },
  moduloPromedioTareas: {
    fontSize: 9,
    marginTop: 2,
  },
  moduloPromedioValue: {
    alignItems: 'flex-end',
  },
  moduloPromedioNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  moduloPromedioLabel: {
    fontSize: 8,
    marginTop: 2,
  },
  emptyModuloCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  emptyModuloTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyModuloText: {
    fontSize: 11,
    textAlign: 'center',
  },
  moduloCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  moduloHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduloHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  moduloHeaderInfo: {
    flex: 1,
  },
  moduloNombre: {
    fontSize: 12,
    fontWeight: '700',
  },
  moduloTareas: {
    fontSize: 10,
    marginTop: 2,
  },
  moduloHeaderRight: {
    alignItems: 'flex-end',
  },
  moduloPromedio: {
    fontSize: 16,
    fontWeight: '900',
  },
  moduloPromedioLabelSmall: {
    fontSize: 8,
    marginTop: 2,
  },
  moduloOcultoContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  moduloOcultoBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  moduloOcultoText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moduloOcultoSubtext: {
    fontSize: 8,
  },
  tareasModuloContainer: {
    padding: 6,
  },
  tareaCalificacionCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  tareaCalificacionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tareaCalificacionTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  tareaNotaBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tareaNotaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tareaNotaMax: {
    fontSize: 10,
    marginLeft: 2,
  },
  tareaPonderacion: {
    fontSize: 9,
    marginLeft: 6,
    borderLeftWidth: 1,
    paddingLeft: 6,
  },
  tareaComentario: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    marginTop: 6,
  },
  tareaComentarioText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  tareaCalificacionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  tareaFechaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tareaFechaText: {
    fontSize: 9,
  },
  tareaResultadoBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tareaResultadoText: {
    fontSize: 9,
    fontWeight: '600',
  },
});
