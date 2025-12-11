import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { API_URL } from '../../../constants/config';
import { storage, getToken, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

// Helper para calcular la próxima clase
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

  // Buscar el próximo día de clase
  let proximoDia = -1;
  let diasHastaClase = -1;

  // Ordenar días para buscar en orden
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
      // 3. Buscar en la próxima semana (el día más temprano)
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

      console.log('Fetching cursos desde:', `${API_URL}/estudiantes/mis-cursos`);
      const response = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Cursos cargados:', data.length);
        setCursos(data);
      } else {
        console.error('Error al cargar cursos:', response.status);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Configurar eventos de WebSocket para actualizaciones en tiempo real
  const socketEvents = {
    'nueva_tarea': (data: any) => {
      console.log('Nueva tarea recibida:', data.titulo_tarea);
      fetchCursos();
    },
    'nuevo_modulo': (data: any) => {
      console.log('Nuevo módulo recibido:', data.nombre_modulo);
      fetchCursos();
    },
    'tarea_calificada': (data: any) => {
      console.log('Tarea calificada con', data.nota, 'puntos');
      fetchCursos();
    },
    'progreso_actualizado': (data: any) => {
      console.log('Progreso actualizado');
      fetchCursos();
    },
    'tarea_entregada': (data: any) => {
      console.log('Tarea entregada');
      fetchCursos();
    }
  };

  // Inicializar WebSocket con userId del usuario actual
  useSocket(socketEvents, userData?.id_usuario);

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: 'rgba(18, 18, 18, 0.95)',
      text: '#fff',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)',
      border: 'rgba(251, 191, 36, 0.2)',
      accent: '#fbbf24',
    }
    : {
      bg: '#f8fafc',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      text: '#1e293b',
      textSecondary: 'rgba(30, 41, 59, 0.7)',
      textMuted: 'rgba(30, 41, 59, 0.5)',
      border: 'rgba(251, 191, 36, 0.2)',
      accent: '#fbbf24',
    };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);

      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }

      const user = await getUserData();
      if (isMounted) {
        setUserData(user);
      }

      await fetchCursos();

      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    const handleThemeChange = (value: boolean) => {
      setDarkMode(value);
    };

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



  const promedioGeneral = cursos.length > 0
    ? Math.round(cursos.reduce((acc, c) => acc + (c.progreso || 0), 0) / cursos.length) || 0
    : 0;

  const promedioCalificaciones = cursos.length > 0 && cursos.some(c => c.calificacion)
    ? (cursos.reduce((acc, c) => acc + (Number(c.calificacion) || 0), 0) / cursos.length).toFixed(1)
    : '0.0';

  const totalTareasPendientes = cursos.reduce((acc, c) => acc + (c.tareasPendientes || 0), 0);



  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingTop: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header de Bienvenida */}
        <View style={[styles.welcomeCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            👋 ¡Bienvenido{userData?.nombres ? `, ${userData.nombres} ${userData.apellidos || ''}` : (userData?.nombre ? `, ${userData.nombre} ${userData.apellido || ''}` : '')}!
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Continúa tu formación en Belleza y Estética
          </Text>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <Ionicons name="calendar" size={14} color={theme.textMuted} />
              <Text style={[styles.dateTimeText, { color: theme.textMuted }]}>
                {new Date().toLocaleDateString('es-ES')}
              </Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Ionicons name="time" size={14} color={theme.textMuted} />
              <Text style={[styles.dateTimeText, { color: theme.textMuted }]}>
                {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
              <Ionicons name="trending-up" size={16} color="#fbbf24" />
            </View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Progreso</Text>
            <Text style={[styles.statValue, { color: '#fbbf24' }]}>{promedioGeneral}%</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="book" size={16} color="#3b82f6" />
            </View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Cursos</Text>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{cursos.length}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="star" size={16} color="#10b981" />
            </View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Promedio</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{promedioCalificaciones}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="clipboard" size={16} color="#8b5cf6" />
            </View>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Tareas</Text>
            <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{totalTareasPendientes}</Text>
          </View>
        </View>



        {/* Cursos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Mis Cursos</Text>

          {loading ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Cargando cursos...</Text>
            </View>
          ) : cursos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons name="book-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No tienes cursos activos</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Una vez matriculado, tus cursos aparecerán aquí
              </Text>
            </View>
          ) : (
            cursos.map((curso) => (
              <TouchableOpacity
                key={curso.id_curso}
                style={[styles.cursoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                activeOpacity={0.7}
              >
                <View style={styles.cursoHeader}>
                  <View style={styles.cursoInfo}>
                    <View style={[styles.cursoBadge, { backgroundColor: `${theme.accent}20` }]}>
                      <Text style={[styles.cursoBadgeText, { color: theme.accent }]}>
                        {curso.codigo_curso}
                      </Text>
                    </View>
                    <Text style={[styles.cursoNombre, { color: theme.text }]} numberOfLines={2}>
                      {curso.nombre}
                    </Text>
                  </View>
                  <View style={styles.cursoStats}>
                    <View style={styles.cursoStat}>
                      <Ionicons name="star" size={12} color={theme.accent} />
                      <Text style={[styles.cursoStatText, { color: theme.accent }]}>
                        {curso.calificacion ? Number(curso.calificacion).toFixed(1) : '0.0'}
                      </Text>
                    </View>
                    <Text style={[styles.cursoProgreso, { color: theme.textSecondary }]}>
                      {Math.round(curso.progreso || 0)}%
                    </Text>
                  </View>
                </View>

                {/* Información del curso en grid */}
                <View style={styles.cursoDetailsGrid}>
                  {curso.docente && (
                    <View style={[styles.cursoDetailCard, { backgroundColor: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.25)' }]}>
                      <View style={styles.cursoDetailHeader}>
                        <Ionicons name="school" size={12} color={theme.accent} />
                        <Text style={[styles.cursoDetailLabel, { color: theme.accent }]}>DOCENTE</Text>
                      </View>
                      <Text style={[styles.cursoDetailValue, { color: theme.text }]} numberOfLines={1}>
                        {curso.docente.nombre_completo}
                      </Text>
                      {curso.docente.titulo && (
                        <Text style={[styles.cursoDetailSubtext, { color: theme.textMuted }]} numberOfLines={1}>
                          {curso.docente.titulo}
                        </Text>
                      )}
                    </View>
                  )}

                  {curso.aula && (
                    <View style={[styles.cursoDetailCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                      <View style={styles.cursoDetailHeader}>
                        <Ionicons name="location" size={12} color="#f59e0b" />
                        <Text style={[styles.cursoDetailLabel, { color: '#f59e0b' }]}>AULA</Text>
                      </View>
                      <Text style={[styles.cursoDetailValue, { color: theme.text }]} numberOfLines={1}>
                        {curso.aula.nombre}
                      </Text>
                      {curso.aula.ubicacion && (
                        <Text style={[styles.cursoDetailSubtext, { color: theme.textMuted }]} numberOfLines={1}>
                          {curso.aula.ubicacion}
                        </Text>
                      )}
                    </View>
                  )}

                  {curso.horario && (
                    <View style={[styles.cursoDetailCard, { backgroundColor: 'rgba(217, 119, 6, 0.08)', borderColor: 'rgba(217, 119, 6, 0.25)' }]}>
                      <View style={styles.cursoDetailHeader}>
                        <Ionicons name="time" size={12} color="#d97706" />
                        <Text style={[styles.cursoDetailLabel, { color: '#d97706' }]}>HORARIO</Text>
                      </View>
                      <Text style={[styles.cursoDetailValue, { color: theme.text }]}>
                        {curso.horario.hora_inicio?.substring(0, 5)} - {curso.horario.hora_fin?.substring(0, 5)}
                      </Text>
                      {curso.horario.dias && (
                        <View style={styles.diasContainer}>
                          {curso.horario.dias.split(',').slice(0, 3).map((dia: string, idx: number) => (
                            <Text key={idx} style={[styles.diaChip, { backgroundColor: 'rgba(251, 191, 36, 0.15)', color: theme.accent }]}>
                              {dia.trim()}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Barra de progreso mejorada */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: theme.textMuted }]}>Progreso del curso</Text>
                    <View style={styles.progressStats}>
                      <Text style={[styles.progressPercentage, { color: theme.text }]}>
                        {Math.round(curso.progreso || 0)}%
                      </Text>
                      <View style={[styles.calificacionChip, { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}30` }]}>
                        <Text style={[styles.calificacionChipText, { color: theme.accent }]}>
                          {curso.calificacion ? Number(curso.calificacion).toFixed(1) : '0.0'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${curso.progreso || 0}%`, backgroundColor: theme.accent }
                      ]}
                    />
                  </View>
                </View>

                {/* Estado de tareas */}
                <View style={styles.tareaStatus}>
                  {curso.tareasPendientes > 0 ? (
                    <View style={styles.tareasBadge}>
                      <Ionicons name="alert-circle" size={12} color="#f59e0b" />
                      <Text style={[styles.tareasText, { color: '#f59e0b' }]}>
                        {curso.tareasPendientes} tareas pendientes
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.tareasBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                      <Text style={[styles.tareasText, { color: '#10b981' }]}>
                        Al día con las tareas
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botones de acción */}
                <View style={styles.actionButtons}>
                  {curso.tareasPendientes > 0 ? (
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                      onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="cloud-upload" size={14} color="#fff" />
                      <Text style={styles.primaryButtonText}>Subir Tarea</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: theme.accent }]}
                      onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.primaryButtonText}>Continuar</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: theme.border }]}
                    onPress={() => router.push(`/roles/estudiante-movil/detallecursoestudiante?id=${curso.id_curso}`)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye" size={14} color={theme.accent} />
                    <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Ver Detalles</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  welcomeCard: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 3,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTimeText: {
    fontSize: 9,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 2,
  },
  statCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 7.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    padding: 16,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cursoCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cursoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cursoInfo: {
    flex: 1,
    gap: 6,
  },
  cursoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  cursoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cursoNombre: {
    fontSize: 14,
    fontWeight: '700',
  },
  cursoStats: {
    alignItems: 'flex-end',
    gap: 3,
  },
  cursoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cursoStatText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cursoProgreso: {
    fontSize: 11,
  },
  cursoDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  cursoDetailCard: {
    flex: 1,
    minWidth: '45%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  cursoDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  cursoDetailLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cursoDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  cursoDetailSubtext: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  diasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 2,
  },
  diaChip: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  progressSection: {
    marginTop: 6,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '700',
  },
  calificacionChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  calificacionChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tareaStatus: {
    marginTop: 6,
    marginBottom: 8,
  },
  tareasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tareasText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },

});
