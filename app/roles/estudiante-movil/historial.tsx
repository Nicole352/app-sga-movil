import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
    bg: '#0a0a0a',
    cardBg: 'rgba(18, 18, 18, 0.95)',
    text: '#fff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(251, 191, 36, 0.2)',
    accent: '#fbbf24',
    success: '#10b981',
    warning: '#f59e0b',
  } : {
    bg: '#f8fafc',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    text: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    textMuted: 'rgba(30, 41, 59, 0.5)',
    border: 'rgba(251, 191, 36, 0.2)',
    accent: '#f59e0b',
    success: '#059669',
    warning: '#d97706',
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const cursosAMostrar = vistaActual === 'activos' ? cursosActivos : cursosFinalizados;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4 }}
      >
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: vistaActual === 'activos' ? theme.accent : theme.cardBg,
                borderColor: theme.border,
              }
            ]}
            onPress={() => setVistaActual('activos')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="book"
              size={14}
              color={vistaActual === 'activos' ? '#fff' : theme.textSecondary}
            />
            <Text style={[styles.tabText, { color: vistaActual === 'activos' ? '#fff' : theme.textSecondary }]}>
              Activos ({cursosActivos.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: vistaActual === 'finalizados' ? theme.accent : theme.cardBg,
                borderColor: theme.border,
              }
            ]}
            onPress={() => setVistaActual('finalizados')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trophy"
              size={14}
              color={vistaActual === 'finalizados' ? '#fff' : theme.textSecondary}
            />
            <Text style={[styles.tabText, { color: vistaActual === 'finalizados' ? '#fff' : theme.textSecondary }]}>
              Finalizados ({cursosFinalizados.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de cursos */}
        <View style={styles.content}>
          {cursosAMostrar.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons
                name={vistaActual === 'activos' ? 'book-outline' : 'trophy-outline'}
                size={40}
                color={theme.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {vistaActual === 'activos' ? 'No tienes cursos activos' : 'No tienes cursos finalizados'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {vistaActual === 'activos'
                  ? 'Tus cursos activos aparecerán aquí'
                  : 'Tus cursos finalizados aparecerán aquí'}
              </Text>
            </View>
          ) : (
            cursosAMostrar.map((curso, index) => {
              const colores = [
                ['#fbbf24', '#f59e0b'],
                ['#f59e0b', '#d97706'],
                ['#d97706', '#b45309'],
              ];
              const [color1, color2] = colores[index % colores.length];

              return (
                <View
                  key={curso.id_curso}
                  style={[styles.cursoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                >
                  {/* Header con gradiente */}
                  <View style={[styles.cursoHeader, { backgroundColor: color1 }]}>
                    <View style={styles.cursoHeaderTop}>
                      <View style={styles.codigoBadge}>
                        <Text style={styles.codigoText}>{curso.codigo_curso}</Text>
                      </View>
                      <View style={[styles.estadoBadge, { backgroundColor: vistaActual === 'finalizados' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(16, 185, 129, 0.3)' }]}>
                        <Ionicons
                          name={vistaActual === 'finalizados' ? 'trophy' : 'checkmark-circle'}
                          size={10}
                          color="#fff"
                        />
                        <Text style={styles.estadoText}>
                          {vistaActual === 'finalizados' ? 'Finalizado' : 'En Curso'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cursoNombre} numberOfLines={2}>{curso.nombre}</Text>
                    <Text style={styles.cursoTipo}>{curso.tipo_curso}</Text>
                  </View>

                  {/* Contenido */}
                  <View style={styles.cursoBody}>
                    {/* Fechas */}
                    <View style={[styles.infoRow, { backgroundColor: theme.bg }]}>
                      <Ionicons name="calendar" size={12} color={theme.accent} />
                      <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>PERÍODO</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>
                          {formatearFecha(curso.fecha_inicio)} - {formatearFecha(curso.fecha_fin)}
                        </Text>
                        <Text style={[styles.infoExtra, { color: theme.textMuted }]}>
                          Duración: {calcularDuracion(curso.fecha_inicio, curso.fecha_fin)}
                        </Text>
                      </View>
                    </View>

                    {/* Docente */}
                    {curso.docente.nombre_completo && (
                      <View style={[styles.infoRow, { backgroundColor: theme.bg }]}>
                        <Ionicons name="person" size={12} color={theme.accent} />
                        <View style={styles.infoContent}>
                          <Text style={[styles.infoLabel, { color: theme.textMuted }]}>DOCENTE</Text>
                          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
                            {curso.docente.nombre_completo}
                          </Text>
                          {curso.docente.titulo && (
                            <Text style={[styles.infoExtra, { color: theme.textMuted }]} numberOfLines={1}>
                              {curso.docente.titulo}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Aula */}
                    {curso.aula?.nombre && (
                      <View style={[styles.infoRow, { backgroundColor: theme.bg }]}>
                        <Ionicons name="business" size={12} color={theme.accent} />
                        <View style={styles.infoContent}>
                          <Text style={[styles.infoLabel, { color: theme.textMuted }]}>AULA</Text>
                          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
                            {curso.aula.nombre}
                          </Text>
                          {curso.aula.ubicacion && (
                            <Text style={[styles.infoExtra, { color: theme.textMuted }]} numberOfLines={1}>
                              {curso.aula.ubicacion}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Horario */}
                    {curso.horario.hora_inicio && (
                      <View style={[styles.infoRow, { backgroundColor: theme.bg }]}>
                        <Ionicons name="time" size={12} color={theme.accent} />
                        <View style={styles.infoContent}>
                          <Text style={[styles.infoLabel, { color: theme.textMuted }]}>HORARIO</Text>
                          <Text style={[styles.infoValue, { color: theme.text }]}>
                            {curso.horario.hora_inicio} - {curso.horario.hora_fin}
                          </Text>
                          {curso.horario.dias && (
                            <Text style={[styles.infoExtra, { color: theme.textMuted }]}>{curso.horario.dias}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Estadísticas */}
                    <View style={styles.statsContainer}>
                      <View style={[styles.statBox, { backgroundColor: `${theme.accent}15` }]}>
                        <Text style={[styles.statValue, { color: theme.accent }]}>{curso.progreso}%</Text>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Progreso</Text>
                      </View>
                      <View style={[styles.statBox, { backgroundColor: curso.calificacion >= 7 ? `${theme.success}15` : `${theme.warning}15` }]}>
                        <Text style={[styles.statValue, { color: curso.calificacion >= 7 ? theme.success : theme.warning }]}>
                          {curso.calificacion != null ? Number(curso.calificacion).toFixed(1) : '0.0'}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Nota</Text>
                      </View>
                      {vistaActual === 'activos' && (
                        <View style={[styles.statBox, { backgroundColor: curso.tareasPendientes > 0 ? `${theme.warning}15` : `${theme.success}15` }]}>
                          <Text style={[styles.statValue, { color: curso.tareasPendientes > 0 ? theme.warning : theme.success }]}>
                            {curso.tareasPendientes}
                          </Text>
                          <Text style={[styles.statLabel, { color: theme.textMuted }]}>Pendientes</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
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
  tabsContainer: {
    flexDirection: 'row',
    gap: 6,
    padding: 16,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingTop: 4,
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
    marginBottom: 12,
    overflow: 'hidden',
  },
  cursoHeader: {
    padding: 12,
  },
  cursoHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  codigoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  codigoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  estadoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  cursoNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
  },
  cursoTipo: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cursoBody: {
    padding: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderRadius: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: '600',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoExtra: {
    fontSize: 9,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  statBox: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
