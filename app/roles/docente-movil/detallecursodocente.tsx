import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert, Platform, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getToken, getDarkMode, getUserData } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { useSocket } from '../../../hooks/useSocket';
import ModalModulo from './ModalModulo';
import ModalTarea from './ModalTarea';
import ModalEntregas from './ModalEntregas';

interface Modulo {
  id_modulo: number;
  nombre: string;
  descripcion: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  total_tareas: number;
  promedios_publicados: boolean;
  categorias?: Array<{ id_categoria: number; nombre: string; ponderacion: number }>;
}

interface Tarea {
  id_tarea: number;
  id_modulo?: number;
  titulo: string;
  descripcion: string;
  fecha_limite: string;
  nota_maxima: number;
  ponderacion: number;
  estado: string;
  total_entregas: number;
  entregas_calificadas: number;
}

interface Curso {
  id_curso: number;
  nombre: string;
  codigo_curso: string;
  total_estudiantes: number;
}

export default function DetalleCursoDocenteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id_curso = params.id as string;

  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [tareasPorModulo, setTareasPorModulo] = useState<{ [key: number]: Tarea[] }>({});
  const [modulosExpandidos, setModulosExpandidos] = useState<{ [key: number]: boolean }>({});
  const [showModalModulo, setShowModalModulo] = useState(false);
  const [showModalTarea, setShowModalTarea] = useState(false);
  const [showModalEntregas, setShowModalEntregas] = useState(false);
  const [moduloSeleccionado, setModuloSeleccionado] = useState<number | null>(null);
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null);
  const [moduloEditar, setModuloEditar] = useState<Modulo | null>(null);
  const [tareaEditar, setTareaEditar] = useState<Tarea | null>(null);

  useEffect(() => {
    getUserData().then(user => setUserId(user?.id_usuario));
  }, []);

  useSocket({
    'modulo_creado': () => fetchModulos(),
    'nueva_tarea': (data: any) => {
      fetchModulos(true);
      if (data.id_modulo && modulosExpandidos[data.id_modulo]) {
        fetchTareasModulo(data.id_modulo);
      }
    },
    'tarea_entregada_docente': (data: any) => {
      fetchModulos(true);
      const targetModulo = data.id_modulo || data.modulo_id;
      if (targetModulo && modulosExpandidos[targetModulo]) {
        fetchTareasModulo(targetModulo);
      } else {
        Object.keys(modulosExpandidos).forEach(id => {
          if (modulosExpandidos[parseInt(id)]) {
            fetchTareasModulo(parseInt(id));
          }
        });
      }
    },
    'tarea_entregada': (data: any) => {
      fetchModulos(true);
      const targetModulo = data.id_modulo || data.modulo_id;
      if (targetModulo && modulosExpandidos[targetModulo]) {
        fetchTareasModulo(targetModulo);
      } else {
        Object.keys(modulosExpandidos).forEach(id => {
          if (modulosExpandidos[parseInt(id)]) {
            fetchTareasModulo(parseInt(id));
          }
        });
      }
    },
    'entrega_actualizada': (data: any) => {
      fetchModulos(true);
      const targetModulo = data.id_modulo || data.modulo_id;
      if (targetModulo && modulosExpandidos[targetModulo]) {
        fetchTareasModulo(targetModulo);
      } else {
        Object.keys(modulosExpandidos).forEach(id => {
          if (modulosExpandidos[parseInt(id)]) {
            fetchTareasModulo(parseInt(id));
          }
        });
      }
    },
    'modulo_actualizado': () => fetchModulos(true),
    'tarea_actualizada': (data: any) => {
      fetchModulos(true);
      if (data.id_modulo && modulosExpandidos[data.id_modulo]) {
        fetchTareasModulo(data.id_modulo);
      }
    },
    'modulo_eliminado': () => fetchModulos(true),
    'tarea_eliminada': (data: any) => {
      fetchModulos(true);
      if (data.id_modulo && modulosExpandidos[data.id_modulo]) {
        fetchTareasModulo(data.id_modulo);
      }
    },
    'curso_asignado': () => loadData(),
  }, userId);

  useEffect(() => {
    loadData();
  }, [id_curso]);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await Promise.all([fetchCursoData(), fetchModulos()]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fetchCursoData = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/cursos/${id_curso}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurso(data);
      }
    } catch (error) {
      console.error('Error fetching curso:', error);
    }
  };

  const fetchModulos = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = await getToken();
      const response = await fetch(`${API_URL}/modulos/curso/${id_curso}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setModulos(data.modulos || []);
      }
    } catch (error) {
      console.error('Error fetching modulos:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchTareasModulo = async (id_modulo: number) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/tareas/modulo/${id_modulo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTareasPorModulo(prev => ({
          ...prev,
          [id_modulo]: data.tareas || []
        }));
      }
    } catch (error) {
      console.error('Error fetching tareas:', error);
    }
  };

  const toggleModulo = (id_modulo: number) => {
    const isExpanded = modulosExpandidos[id_modulo];
    setModulosExpandidos(prev => ({
      ...prev,
      [id_modulo]: !isExpanded
    }));

    if (!isExpanded && !tareasPorModulo[id_modulo]) {
      fetchTareasModulo(id_modulo);
    }
  };

  const handleTogglePromedios = async (id_modulo: number, publicados: boolean) => {
    try {
      const token = await getToken();
      const endpoint = publicados ? 'ocultar-promedios' : 'publicar-promedios';

      const response = await fetch(`${API_URL}/modulos/${id_modulo}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        Alert.alert('Éxito', publicados ? 'Promedios ocultados' : 'Promedios publicados');
        fetchModulos();
      }
    } catch (error) {
      console.error('Error toggling promedios:', error);
      Alert.alert('Error', 'No se pudo actualizar los promedios');
    }
  };

  const handleCerrarModulo = async (id_modulo: number) => {
    Alert.alert(
      'Cerrar módulo',
      'Los estudiantes ya no podrán enviar tareas una vez que cierres este módulo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/modulos/${id_modulo}/cerrar`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Módulo cerrado exitosamente');
                fetchModulos();
              } else {
                Alert.alert('Error', 'No se pudo cerrar el módulo');
              }
            } catch (error) {
              console.error('Error cerrando módulo:', error);
              Alert.alert('Error', 'No se pudo cerrar el módulo');
            }
          }
        }
      ]
    );
  };

  const handleReabrirModulo = async (id_modulo: number) => {
    Alert.alert(
      'Reabrir módulo',
      'Los estudiantes podrán enviar tareas nuevamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, reabrir',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/modulos/${id_modulo}/reabrir`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Módulo reabierto exitosamente');
                fetchModulos();
              } else {
                Alert.alert('Error', 'No se pudo reabrir el módulo');
              }
            } catch (error) {
              console.error('Error reabriendo módulo:', error);
              Alert.alert('Error', 'No se pudo reabrir el módulo');
            }
          }
        }
      ]
    );
  };

  const handleEditarModulo = (modulo: Modulo) => {
    setModuloEditar(modulo);
    setShowModalModulo(true);
  };

  const handleEliminarModulo = async (id_modulo: number) => {
    Alert.alert(
      'Eliminar módulo',
      'Se eliminarán todas las tareas asociadas. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/modulos/${id_modulo}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Módulo eliminado exitosamente');
                fetchModulos();
              } else {
                Alert.alert('Error', 'No se pudo eliminar el módulo');
              }
            } catch (error) {
              console.error('Error eliminando módulo:', error);
              Alert.alert('Error', 'No se pudo eliminar el módulo');
            }
          }
        }
      ]
    );
  };

  const handleEditarTarea = (tarea: Tarea, id_modulo: number) => {
    setTareaEditar(tarea);
    setModuloSeleccionado(id_modulo);
    setShowModalTarea(true);
  };

  const handleEliminarTarea = async (tarea: Tarea, id_modulo: number) => {
    if (tarea.total_entregas > 0) {
      Alert.alert('No se puede eliminar', 'No se puede eliminar una tarea que ya tiene entregas de alumnos.');
      return;
    }

    Alert.alert(
      'Eliminar tarea',
      'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/tareas/${tarea.id_tarea}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Tarea eliminada exitosamente');
                fetchTareasModulo(id_modulo);
                fetchModulos();
              } else {
                Alert.alert('Error', 'No se pudo eliminar la tarea');
              }
            } catch (error) {
              console.error('Error eliminando tarea:', error);
              Alert.alert('Error', 'No se pudo eliminar la tarea');
            }
          }
        }
      ]
    );
  };

  const theme = {
    bg: darkMode ? '#0a0a0a' : '#f8fafc',
    cardBg: darkMode ? '#141414' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? '#a1a1aa' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? '#71717a' : 'rgba(30,41,59,0.6)',
    border: darkMode ? '#27272a' : 'rgba(59, 130, 246, 0.3)',
    accent: '#3b82f6',
    primaryGradient: ['#3b82f6', '#2563eb'] as const,
    blue: '#3b82f6',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'activo':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'finalizado':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/*HEADER */}
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{curso?.nombre || 'Detalle del Curso'}</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {curso?.codigo_curso} • {curso?.total_estudiantes || 0} estudiantes
              </Text>
            </View>

            <View style={[styles.headerIconContainer, { backgroundColor: theme.blue + '15' }]}>
              <Ionicons name="book" size={24} color={theme.blue} />
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* Herramientas */}
        <View style={[styles.toolsCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.toolsHeader}>
            <Text style={[styles.toolsTitle, { color: theme.text }]}>Herramientas de Gestión</Text>
            <Text style={[styles.toolsSubtitle, { color: theme.textSecondary }]}>
              Módulos, tareas y configuración
            </Text>
          </View>
          <View style={styles.toolsButtons}>
            <TouchableOpacity
              style={[styles.toolButton, { backgroundColor: theme.blue }]}
              onPress={() => {
                setModuloEditar(null);
                setShowModalModulo(true);
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.toolButtonText}>Módulo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: theme.green + '20', borderColor: theme.green + '40' }]}
              onPress={onRefresh}
            >
              <Ionicons name="refresh" size={16} color={theme.green} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista de Módulos */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando módulos...</Text>
          </View>
        ) : modulos.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="book-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay módulos creados</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Los módulos (parciales) aparecerán aquí cuando se creen
            </Text>
          </View>
        ) : (
          <View style={styles.modulosList}>
            {modulos.map((modulo) => {
              const estadoColor = getEstadoColor(modulo.estado);
              const isExpanded = modulosExpandidos[modulo.id_modulo];

              // Cálculo de categorías faltantes
              const categoriasConfiguradas = modulo.categorias || [];
              const tareasModulo = tareasPorModulo[modulo.id_modulo] || [];
              const categoriasConTareas = new Set(tareasModulo.map(t => (t as any).categoria_nombre).filter(Boolean));
              const categoriasFaltantes = categoriasConfiguradas.filter(cat => !categoriasConTareas.has(cat.nombre));

              return (
                <View key={modulo.id_modulo} style={[styles.moduloCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  {/* Header del Módulo */}
                  <TouchableOpacity
                    style={styles.moduloHeader}
                    onPress={() => toggleModulo(modulo.id_modulo)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.moduloHeaderContent}>
                      <Text style={[styles.moduloNombre, { color: theme.text }]}>{modulo.nombre}</Text>
                      {modulo.descripcion && (
                        <Text style={[styles.moduloDescripcion, { color: theme.textMuted }]} numberOfLines={2}>
                          {modulo.descripcion}
                        </Text>
                      )}

                      <View style={styles.moduloMeta}>
                        <View style={styles.moduloMetaItem}>
                          <Ionicons name="document-text" size={12} color={theme.accent} />
                          <Text style={[styles.moduloMetaText, { color: theme.textMuted }]}>
                            {modulo.total_tareas} {modulo.total_tareas === 1 ? 'tarea' : 'tareas'}
                          </Text>
                        </View>
                        {modulo.fecha_inicio && (
                          <View style={styles.moduloMetaItem}>
                            <Ionicons name="calendar" size={12} color={theme.accent} />
                            <Text style={[styles.moduloMetaText, { color: theme.textMuted }]}>
                              {formatDate(modulo.fecha_inicio)}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.moduloEstadoBadge, { backgroundColor: estadoColor.bg, borderColor: estadoColor.border }]}>
                          <Text style={[styles.moduloEstadoText, { color: estadoColor.color }]}>
                            {modulo.estado}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Aviso de Categorías Faltantes */}
                  {categoriasFaltantes.length > 0 && (
                    <View style={styles.alertPillContainer}>
                      <View style={[styles.alertPill, {
                        backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                        borderColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)'
                      }]}>
                        <Ionicons name="alert-circle" size={14} color={theme.accent} />
                        <Text style={[styles.alertPillText, { color: theme.accent }]}>
                          PENDIENTE: Ponderación total debe ser 10 pts. Falta crear tareas para: {categoriasFaltantes.map(c => c.nombre).join(', ')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Botones de Acción del Módulo */}
                  <View style={styles.moduloActions}>
                    <TouchableOpacity
                      style={[styles.moduloActionButton, { backgroundColor: theme.blue + '20', borderColor: theme.blue + '40' }]}
                      onPress={() => handleEditarModulo(modulo)}
                    >
                      <Ionicons name="pencil" size={14} color={theme.blue} />
                      <Text style={[styles.moduloActionText, { color: theme.blue }]}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.moduloActionButton, { backgroundColor: modulo.promedios_publicados ? theme.blue + '20' : 'rgba(156, 163, 175, 0.15)', borderColor: modulo.promedios_publicados ? theme.blue + '40' : 'rgba(156, 163, 175, 0.3)' }]}
                      onPress={() => handleTogglePromedios(modulo.id_modulo, modulo.promedios_publicados)}
                    >
                      <Ionicons name={modulo.promedios_publicados ? 'eye' : 'eye-off'} size={14} color={modulo.promedios_publicados ? theme.blue : '#9ca3af'} />
                      <Text style={[styles.moduloActionText, { color: modulo.promedios_publicados ? theme.blue : '#9ca3af' }]}>
                        {modulo.promedios_publicados ? 'Visible' : 'Oculto'}
                      </Text>
                    </TouchableOpacity>

                    {modulo.estado === 'finalizado' ? (
                      <TouchableOpacity
                        style={[styles.moduloActionButton, { backgroundColor: theme.blue + '20', borderColor: theme.blue + '40' }]}
                        onPress={() => handleReabrirModulo(modulo.id_modulo)}
                      >
                        <Ionicons name="refresh" size={14} color={theme.blue} />
                        <Text style={[styles.moduloActionText, { color: theme.blue }]}>Reabrir</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.moduloActionButton, { backgroundColor: theme.orange + '20', borderColor: theme.orange + '40' }]}
                        onPress={() => handleCerrarModulo(modulo.id_modulo)}
                      >
                        <Ionicons name="lock-closed" size={14} color={theme.orange} />
                        <Text style={[styles.moduloActionText, { color: theme.orange }]}>Cerrar</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.moduloActionButton, { backgroundColor: theme.red + '20', borderColor: theme.red + '40' }]}
                      onPress={() => handleEliminarModulo(modulo.id_modulo)}
                    >
                      <Ionicons name="trash" size={14} color={theme.red} />
                    </TouchableOpacity>
                  </View>

                  {/* Lista de Tareas (expandible) */}
                  {
                    isExpanded && (
                      <View style={styles.tareasContainer}>
                        <TouchableOpacity
                          style={[styles.addTareaButton, { backgroundColor: theme.blue }]}
                          onPress={() => {
                            setModuloSeleccionado(modulo.id_modulo);
                            setShowModalTarea(true);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#fff" />
                          <Text style={styles.addTareaButtonText}>Nueva Tarea</Text>
                        </TouchableOpacity>

                        {!tareasPorModulo[modulo.id_modulo] ? (
                          <Text style={[styles.tareasLoading, { color: theme.textMuted }]}>Cargando tareas...</Text>
                        ) : tareasPorModulo[modulo.id_modulo].length === 0 ? (
                          <View style={styles.tareasEmpty}>
                            <Ionicons name="document-text-outline" size={36} color={theme.textMuted} style={{ opacity: 0.3 }} />
                            <Text style={[styles.tareasEmptyText, { color: theme.textMuted }]}>
                              No hay tareas en este módulo
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.tareasList}>
                            {/* Agrupación por Categoría */}
                            {(() => {
                              const tareasModulo = tareasPorModulo[modulo.id_modulo] || [];
                              const tareasPorCategoria = tareasModulo.reduce((acc, tarea) => {
                                // Usar cast para propiedades que no estén en la interfaz base pero vengan del backend
                                const tareaAny = tarea as any;
                                const nombreCat = tareaAny.categoria_nombre || 'Sin Categoría';
                                const ponderacionCat = tareaAny.categoria_ponderacion || 0;
                                const key = `${nombreCat}|${ponderacionCat}`;

                                if (!acc[key]) acc[key] = [];
                                acc[key].push(tarea);
                                return acc;
                              }, {} as Record<string, Tarea[]>);

                              return Object.entries(tareasPorCategoria).map(([key, tareas]) => {
                                const [nombreCat, ponderacionCat] = key.split('|');

                                return (
                                  <View key={key}>
                                    {nombreCat !== 'Sin Categoría' && (
                                      <View style={[styles.categoryHeader, {
                                        backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                        borderLeftColor: theme.accent
                                      }]}>
                                        <Ionicons name="ribbon" size={18} color={theme.accent} />
                                        <Text style={[styles.categoryTitle, { color: theme.text }]}>{nombreCat}</Text>
                                        <View style={[styles.categoryBadge, { backgroundColor: theme.accent }]}>
                                          <Text style={styles.categoryBadgeText}>{ponderacionCat} pts</Text>
                                        </View>
                                      </View>
                                    )}

                                    {tareas.map((tarea) => (
                                      <View key={tarea.id_tarea} style={[styles.tareaCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                                        <Text style={[styles.tareaTitulo, { color: theme.text }]}>{tarea.titulo}</Text>
                                        {tarea.descripcion && (
                                          <Text style={[styles.tareaDescripcion, { color: theme.textMuted }]} numberOfLines={2}>
                                            {tarea.descripcion}
                                          </Text>
                                        )}

                                        <View style={styles.tareaInfo}>
                                          <View style={styles.tareaInfoItem}>
                                            <Ionicons name="time" size={12} color={theme.textMuted} />
                                            <Text style={[styles.tareaInfoText, { color: theme.textMuted }]}>
                                              {formatDateTime(tarea.fecha_limite)}
                                            </Text>
                                          </View>
                                          <View style={styles.tareaInfoItem}>
                                            <Ionicons name="checkmark-circle" size={12} color={theme.green} />
                                            <Text style={[styles.tareaInfoText, { color: theme.green }]}>
                                              {tarea.entregas_calificadas}/{tarea.total_entregas}
                                            </Text>
                                          </View>
                                          <View style={styles.tareaInfoItem}>
                                            <Ionicons name="alert-circle" size={12} color={theme.red} />
                                            <Text style={[styles.tareaInfoText, { color: theme.red }]}>
                                              {tarea.nota_maxima}pts | {tarea.ponderacion}%
                                            </Text>
                                          </View>
                                        </View>

                                        {/* Botones de acción */}
                                        <View style={styles.tareaActions}>
                                          <TouchableOpacity
                                            style={[styles.tareaActionButton, { backgroundColor: theme.blue + '20', borderColor: theme.blue + '40' }]}
                                            onPress={() => handleEditarTarea(tarea, modulo.id_modulo)}
                                          >
                                            <Ionicons name="pencil" size={14} color={theme.blue} />
                                            <Text style={[styles.tareaActionText, { color: theme.blue }]}>Editar</Text>
                                          </TouchableOpacity>

                                          <TouchableOpacity
                                            style={[styles.tareaActionButton, { backgroundColor: theme.red + '20', borderColor: theme.red + '40' }]}
                                            onPress={() => handleEliminarTarea(tarea, modulo.id_modulo)}
                                          >
                                            <Ionicons name="trash" size={14} color={theme.red} />
                                            <Text style={[styles.tareaActionText, { color: theme.red }]}>Eliminar</Text>
                                          </TouchableOpacity>
                                        </View>

                                        {tarea.total_entregas > 0 && (
                                          <TouchableOpacity
                                            style={[styles.tareaButton, { backgroundColor: theme.blue }]}
                                            onPress={() => {
                                              setTareaSeleccionada(tarea);
                                              setShowModalEntregas(true);
                                            }}
                                          >
                                            <Ionicons name="document-text" size={14} color="#fff" />
                                            <Text style={styles.tareaButtonText}>Ver Entregas ({tarea.total_entregas})</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                );
                              });
                            })()}
                          </View>
                        )}

                      </View>
                    )
                  }
                </View>
              );
            })}
          </View >
        )
        }
      </ScrollView >

      {/* Modales */}
      < ModalModulo
        visible={showModalModulo}
        onClose={() => setShowModalModulo(false)}
        onSuccess={() => {
          setShowModalModulo(false);
          fetchModulos();
        }}
        id_curso={id_curso}
        moduloEditar={moduloEditar}
      />

      <ModalTarea
        visible={showModalTarea}
        onClose={() => {
          setShowModalTarea(false);
          setModuloSeleccionado(null);
          setTareaSeleccionada(null);
        }}
        onSuccess={() => {
          setShowModalTarea(false);
          if (moduloSeleccionado) {
            fetchTareasModulo(moduloSeleccionado);
            fetchModulos();
          }
          setModuloSeleccionado(null);
          setTareaSeleccionada(null);
        }}
        id_modulo={moduloSeleccionado || 0}
        tareaEditar={tareaSeleccionada}
      />

      {
        tareaSeleccionada && (
          <ModalEntregas
            visible={showModalEntregas}
            onClose={() => {
              setShowModalEntregas(false);
              setTareaSeleccionada(null);
            }}
            onSuccess={() => {
              if (tareaSeleccionada.id_modulo) {
                fetchTareasModulo(tareaSeleccionada.id_modulo);
              }
            }}
            id_tarea={tareaSeleccionada.id_tarea}
            nombre_tarea={tareaSeleccionada.titulo}
            nota_maxima={tareaSeleccionada.nota_maxima}
            ponderacion={tareaSeleccionada.ponderacion}
          />
        )
      }
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: -20,
    zIndex: 10
  },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  toolsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolsHeader: {
    flex: 1,
  },
  toolsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toolsSubtitle: {
    fontSize: 12,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modulosList: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  moduloCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  moduloHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 14,
  },
  moduloHeaderContent: {
    flex: 1,
    marginRight: 12,
  },
  moduloNombre: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  moduloDescripcion: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },

  // Categorías
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 10,
    gap: 10,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  moduloMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  moduloMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moduloMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moduloEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  moduloEstadoText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  moduloActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  moduloActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  moduloActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tareasContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  tareasLoading: {
    textAlign: 'center',
    padding: 12,
    fontSize: 13,
  },
  tareasEmpty: {
    alignItems: 'center',
    padding: 20,
  },
  tareasEmptyText: {
    fontSize: 13,
    marginTop: 8,
  },
  tareasList: {
    gap: 10,
  },
  tareaCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  tareaTitulo: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  tareaDescripcion: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  tareaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  tareaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tareaInfoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tareaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tareaButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  toolsButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  addTareaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  addTareaButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tareaActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  tareaActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tareaActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertPillContainer: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: -4,
    paddingHorizontal: 14,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  alertPillText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
