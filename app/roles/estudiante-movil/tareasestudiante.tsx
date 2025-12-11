import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Linking } from 'react-native';
import { useState, useEffect } from 'react';
import { useGlobalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

interface Tarea {
  id_tarea: number;
  titulo: string;
  descripcion: string;
  instrucciones: string;
  fecha_limite: string;
  nota_maxima: number;
  nota_minima_aprobacion: number;
  modulo_nombre: string;
  modulo_orden: number;
  estado_estudiante: 'pendiente' | 'entregado' | 'calificado';
  id_entrega: number | null;
  fecha_entrega: string | null;
  nota: number | null;
  resultado: string | null;
  comentario_docente: string | null;
  archivo_url?: string;
  archivo_public_id?: string;
}

interface ModuloAgrupado {
  nombre: string;
  orden: number;
  tareas: Tarea[];
}

interface Curso {
  nombre: string;
  codigo_curso: string;
}

export default function TareasEstudiante() {
  const { id_curso } = useGlobalSearchParams();
  const [darkMode, setDarkMode] = useState(false);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [modulosAgrupados, setModulosAgrupados] = useState<ModuloAgrupado[]>([]);
  const [modulosExpandidos, setModulosExpandidos] = useState<{ [key: number]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModalEntrega, setShowModalEntrega] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null);
  const [archivo, setArchivo] = useState<any>(null);
  const [comentario, setComentario] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [entregaToDelete, setEntregaToDelete] = useState<number | null>(null);

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: 'rgba(18, 18, 18, 0.95)',
    text: '#fff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    border: 'rgba(251, 191, 36, 0.2)',
    accent: '#fbbf24',
  } : {
    bg: '#f8fafc',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    text: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    textMuted: 'rgba(30, 41, 59, 0.5)',
    border: 'rgba(251, 191, 36, 0.2)',
    accent: '#f59e0b',
  };

  useEffect(() => {
    loadDarkMode();
    fetchData();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  useEffect(() => {
    if (tareas.length > 0) {
      agruparTareasPorModulo();
    }
  }, [tareas]);

  const loadDarkMode = async () => {
    const savedMode = await storage.getItem('dark_mode');
    if (savedMode !== null) {
      setDarkMode(savedMode === 'true');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      // Obtener datos del curso
      const cursoResponse = await fetch(`${API_URL}/cursos/${id_curso}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (cursoResponse.ok) {
        const cursoData = await cursoResponse.json();
        setCurso(cursoData);
      }

      // Obtener tareas del curso
      const tareasResponse = await fetch(`${API_URL}/tareas/estudiante/curso/${id_curso}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (tareasResponse.ok) {
        const tareasData = await tareasResponse.json();
        setTareas(tareasData.tareas || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const agruparTareasPorModulo = () => {
    const agrupados: { [key: string]: ModuloAgrupado } = {};

    tareas.forEach(tarea => {
      const key = `${tarea.modulo_orden}-${tarea.modulo_nombre}`;
      if (!agrupados[key]) {
        agrupados[key] = {
          nombre: tarea.modulo_nombre,
          orden: tarea.modulo_orden,
          tareas: []
        };
      }
      agrupados[key].tareas.push(tarea);
    });

    const modulosArray = Object.values(agrupados).sort((a, b) => a.orden - b.orden);
    setModulosAgrupados(modulosArray);

    // Expandir el primer módulo por defecto
    if (modulosArray.length > 0 && Object.keys(modulosExpandidos).length === 0) {
      setModulosExpandidos({ [modulosArray[0].orden]: true });
    }
  };

  const toggleModulo = (orden: number) => {
    setModulosExpandidos(prev => ({ ...prev, [orden]: !prev[orden] }));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleEntregarTarea = (tarea: Tarea) => {
    setTareaSeleccionada(tarea);
    setShowModalEntrega(true);
    setArchivo(null);
    setComentario('');
  };

  const handleFileChange = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (file.size && file.size > maxSize) {
        Alert.alert('Error', 'El archivo no debe superar 5MB');
        return;
      }

      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension && !allowedTypes.includes(`.${extension}`)) {
        Alert.alert('Error', 'Solo se permiten archivos PDF, JPG, PNG, WEBP');
        return;
      }

      setArchivo(file);
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleSubmitEntrega = async () => {
    if (!archivo && !tareaSeleccionada?.id_entrega) {
      Alert.alert('Error', 'Debes seleccionar un archivo');
      return;
    }

    try {
      setUploading(true);
      const token = await getToken();
      const formData = new FormData();

      formData.append('id_tarea', tareaSeleccionada!.id_tarea.toString());
      formData.append('comentario_estudiante', comentario);

      if (archivo) {
        const fileToUpload: any = {
          uri: archivo.uri,
          name: archivo.name,
          type: archivo.mimeType || 'application/octet-stream',
        };
        formData.append('archivo', fileToUpload);
      }

      let response;
      if (tareaSeleccionada?.id_entrega) {
        response = await fetch(`${API_URL}/entregas/${tareaSeleccionada.id_entrega}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        response = await fetch(`${API_URL}/entregas`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      if (response.ok) {
        Alert.alert(
          'Éxito',
          tareaSeleccionada?.id_entrega ? 'Entrega actualizada exitosamente' : 'Tarea entregada exitosamente'
        );
        setShowModalEntrega(false);
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'No se pudo entregar la tarea');
      }
    } catch (error) {
      console.error('Error submitting entrega:', error);
      Alert.alert('Error', 'Error al entregar tarea');
    } finally {
      setUploading(false);
    }
  };

  const handleEliminarEntrega = async () => {
    if (!entregaToDelete) return;

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/entregas/${entregaToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Entrega eliminada exitosamente');
        fetchData();
      } else {
        Alert.alert('Error', 'No se pudo eliminar la entrega');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al eliminar la entrega');
    } finally {
      setShowConfirmDelete(false);
      setEntregaToDelete(null);
    }
  };

  const openDeleteConfirm = (id_entrega: number) => {
    setEntregaToDelete(id_entrega);
    setShowConfirmDelete(true);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return { bg: 'rgba(251, 191, 36, 0.1)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
      case 'entregado':
        return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'calificado':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'time-outline';
      case 'entregado': return 'cloud-upload-outline';
      case 'calificado': return 'checkmark-circle';
      default: return 'alert-circle-outline';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'entregado': return 'Entregado';
      case 'calificado': return 'Calificado';
      default: return 'Desconocido';
    }
  };

  const calcularPromedioGeneral = () => {
    const tareasCalificadas = tareas.filter(t => t.nota !== null);
    if (tareasCalificadas.length === 0) return null;
    const suma = tareasCalificadas.reduce((acc, t) => acc + (t.nota || 0), 0);
    return (suma / tareasCalificadas.length).toFixed(2);
  };

  const calcularEstadisticas = () => {
    const total = tareas.length;
    const pendientes = tareas.filter(t => t.estado_estudiante === 'pendiente').length;
    const entregadas = tareas.filter(t => t.estado_estudiante === 'entregado').length;
    const calificadas = tareas.filter(t => t.estado_estudiante === 'calificado').length;
    return { total, pendientes, entregadas, calificadas };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando tareas...</Text>
      </View>
    );
  }

  const stats = calcularEstadisticas();
  const promedioGeneral = calcularPromedioGeneral();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.accent} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="book-outline" size={24} color={theme.accent} />
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={2}>
                {curso?.nombre}
              </Text>
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Código: {curso?.codigo_curso}
            </Text>
          </View>
        </View>

        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          {promedioGeneral && (
            <View style={[styles.promedioCard, { backgroundColor: '#10b981' }]}>
              <View style={styles.promedioHeader}>
                <Ionicons name="trophy" size={20} color="#fff" />
                <Text style={styles.promedioLabel}>Promedio General</Text>
              </View>
              <Text style={styles.promedioValor}>{promedioGeneral}</Text>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Total</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.total}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.2)' }]}>
              <Text style={[styles.statLabel, { color: '#fbbf24' }]}>Pendientes</Text>
              <Text style={[styles.statValue, { color: '#fbbf24' }]}>{stats.pendientes}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Text style={[styles.statLabel, { color: '#f59e0b' }]}>Entregadas</Text>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.entregadas}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Text style={[styles.statLabel, { color: '#10b981' }]}>Calificadas</Text>
              <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.calificadas}</Text>
            </View>
          </View>
        </View>

        {/* Lista de Módulos con Tareas */}
        <View style={styles.content}>
          {modulosAgrupados.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={64} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay tareas disponibles</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Tu docente aún no ha creado tareas para este curso
              </Text>
            </View>
          ) : (
            modulosAgrupados.map((modulo) => (
              <View key={modulo.orden} style={[styles.moduloCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {/* Header del Módulo */}
                <TouchableOpacity
                  style={[styles.moduloHeader, { backgroundColor: 'rgba(251, 146, 60, 0.1)' }]}
                  onPress={() => toggleModulo(modulo.orden)}
                  activeOpacity={0.7}
                >
                  <View style={styles.moduloInfo}>
                    <View style={styles.moduloTitleRow}>
                      <View style={[styles.moduloBadge, { backgroundColor: theme.accent }]}>
                        <Text style={styles.moduloBadgeText}>#{modulo.orden}</Text>
                      </View>
                      <Text style={[styles.moduloNombre, { color: theme.text }]}>{modulo.nombre}</Text>
                    </View>
                    <Text style={[styles.moduloTareas, { color: theme.textSecondary }]}>
                      {modulo.tareas.length} tareas
                    </Text>
                  </View>
                  <Ionicons
                    name={modulosExpandidos[modulo.orden] ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={theme.accent}
                  />
                </TouchableOpacity>

                {/* Lista de Tareas */}
                {modulosExpandidos[modulo.orden] && (
                  <View style={styles.tareasContainer}>
                    {modulo.tareas.map((tarea) => {
                      const estadoColor = getEstadoColor(tarea.estado_estudiante);
                      const isVencida = new Date(tarea.fecha_limite) < new Date() && tarea.estado_estudiante === 'pendiente';

                      return (
                        <View
                          key={tarea.id_tarea}
                          style={[
                            styles.tareaCard,
                            { borderColor: isVencida ? 'rgba(239, 68, 68, 0.3)' : theme.border }
                          ]}
                        >
                          {/* Título y Estado */}
                          <View style={styles.tareaHeader}>
                            <Text style={[styles.tareaTitulo, { color: theme.text }]} numberOfLines={2}>
                              {tarea.titulo}
                            </Text>
                            <View style={styles.estadoBadges}>
                              <View style={[styles.estadoBadge, { backgroundColor: estadoColor.bg, borderColor: estadoColor.border }]}>
                                <Ionicons name={getEstadoIcon(tarea.estado_estudiante) as any} size={12} color={estadoColor.text} />
                                <Text style={[styles.estadoText, { color: estadoColor.text }]}>
                                  {getEstadoTexto(tarea.estado_estudiante)}
                                </Text>
                              </View>
                              {isVencida && (
                                <View style={[styles.estadoBadge, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                                  <Text style={[styles.estadoText, { color: '#ef4444' }]}>Vencida</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Descripción */}
                          {tarea.descripcion && (
                            <Text style={[styles.tareaDesc, { color: theme.textSecondary }]} numberOfLines={3}>
                              {tarea.descripcion}
                            </Text>
                          )}

                          {/* Info */}
                          <View style={styles.tareaInfo}>
                            <View style={styles.tareaInfoItem}>
                              <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                              <Text style={[styles.tareaInfoText, { color: theme.textMuted }]}>
                                Límite: {new Date(tarea.fecha_limite).toLocaleDateString('es-ES')}
                              </Text>
                            </View>
                            <View style={styles.tareaInfoItem}>
                              <Ionicons name="star" size={14} color={theme.accent} />
                              <Text style={[styles.tareaInfoText, { color: theme.accent }]}>
                                Nota máx: {tarea.nota_maxima}
                              </Text>
                            </View>
                            {tarea.fecha_entrega && (
                              <View style={styles.tareaInfoItem}>
                                <Ionicons name="cloud-upload-outline" size={14} color="#f59e0b" />
                                <Text style={[styles.tareaInfoText, { color: '#f59e0b' }]}>
                                  Entregado: {new Date(tarea.fecha_entrega).toLocaleDateString('es-ES')}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Calificación */}
                          {tarea.estado_estudiante === 'calificado' && tarea.nota !== null && (
                            <View style={[styles.calificacionCard, {
                              backgroundColor: tarea.nota >= tarea.nota_minima_aprobacion
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                              borderColor: tarea.nota >= tarea.nota_minima_aprobacion
                                ? 'rgba(16, 185, 129, 0.3)'
                                : 'rgba(239, 68, 68, 0.3)'
                            }]}>
                              <View style={styles.calificacionHeader}>
                                <View>
                                  <Text style={[styles.calificacionLabel, { color: theme.textMuted }]}>
                                    Tu Calificación
                                  </Text>
                                  <Text style={[styles.calificacionValor, {
                                    color: tarea.nota >= tarea.nota_minima_aprobacion ? '#10b981' : '#ef4444'
                                  }]}>
                                    {tarea.nota}/{tarea.nota_maxima}
                                  </Text>
                                </View>
                                <View style={[styles.resultadoBadge, {
                                  backgroundColor: tarea.resultado === 'aprobado'
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(239, 68, 68, 0.2)'
                                }]}>
                                  <Text style={[styles.resultadoText, {
                                    color: tarea.resultado === 'aprobado' ? '#10b981' : '#ef4444'
                                  }]}>
                                    {tarea.resultado === 'aprobado' ? '✓ APROBADO' : '✗ REPROBADO'}
                                  </Text>
                                </View>
                              </View>
                              {tarea.comentario_docente && (
                                <View style={styles.comentarioDocente}>
                                  <Text style={[styles.comentarioDocenteLabel, { color: theme.textMuted }]}>
                                    Comentario del docente:
                                  </Text>
                                  <Text style={[styles.comentarioTexto, { color: theme.text }]}>
                                    {tarea.comentario_docente}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Botones de acción */}
                          <View style={styles.tareaActions}>
                            {tarea.estado_estudiante === 'pendiente' && (
                              <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: theme.accent }]}
                                onPress={() => handleEntregarTarea(tarea)}
                              >
                                <Ionicons name="cloud-upload" size={18} color="#fff" />
                                <Text style={styles.actionButtonText}>Entregar</Text>
                              </TouchableOpacity>
                            )}

                            {(tarea.estado_estudiante === 'entregado' || tarea.estado_estudiante === 'calificado') && tarea.id_entrega && (
                              <>
                                {tarea.archivo_url && (
                                  <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#f59e0b', flex: 1 }]}
                                    onPress={() => {
                                      if (tarea.archivo_url) {
                                        Linking.openURL(tarea.archivo_url).catch(err => {
                                          console.error('Error al abrir URL:', err);
                                          Alert.alert('Error', 'No se pudo abrir el archivo');
                                        });
                                      }
                                    }}
                                  >
                                    <Ionicons name="eye" size={18} color="#fff" />
                                    <Text style={styles.actionButtonText}>Ver</Text>
                                  </TouchableOpacity>
                                )}
                                {tarea.estado_estudiante === 'entregado' && (
                                  <>
                                    <TouchableOpacity
                                      style={[styles.actionButton, { backgroundColor: theme.accent, flex: 1 }]}
                                      onPress={() => handleEntregarTarea(tarea)}
                                    >
                                      <Ionicons name="create" size={18} color="#fff" />
                                      <Text style={styles.actionButtonText}>Editar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[styles.actionButton, { backgroundColor: '#ef4444', flex: 1 }]}
                                      onPress={() => openDeleteConfirm(tarea.id_entrega!)}
                                    >
                                      <Ionicons name="trash" size={18} color="#fff" />
                                      <Text style={styles.actionButtonText}>Eliminar</Text>
                                    </TouchableOpacity>
                                  </>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de Entrega */}
      <Modal
        visible={showModalEntrega}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModalEntrega(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            {/* Header del Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalIconContainer, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="document-attach" size={24} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {tareaSeleccionada?.id_entrega ? 'Editar Entrega' : 'Entregar Tarea'}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {tareaSeleccionada?.titulo}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowModalEntrega(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Instrucciones */}
              {tareaSeleccionada?.instrucciones && (
                <View style={[styles.instruccionesCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <View style={styles.instruccionesHeader}>
                    <Ionicons name="information-circle" size={18} color="#f59e0b" />
                    <Text style={[styles.instruccionesTitle, { color: '#f59e0b' }]}>
                      Instrucciones de la Tarea
                    </Text>
                  </View>
                  <Text style={[styles.instruccionesText, { color: theme.textSecondary }]}>
                    {tareaSeleccionada.instrucciones}
                  </Text>
                </View>
              )}

              {/* Selección de Archivo */}
              <View style={styles.fileSection}>
                <Text style={[styles.fileLabel, { color: theme.text }]}>
                  <Ionicons name="cloud-upload" size={16} color={theme.accent} /> Archivo de Entrega *
                </Text>
                <TouchableOpacity
                  style={[styles.filePickerButton, { borderColor: theme.border, backgroundColor: 'rgba(251, 191, 36, 0.05)' }]}
                  onPress={handleFileChange}
                >
                  {!archivo ? (
                    <View style={styles.filePickerContent}>
                      <Ionicons name="cloud-upload-outline" size={32} color={theme.accent} />
                      <Text style={[styles.filePickerText, { color: theme.text }]}>
                        Seleccionar archivo
                      </Text>
                      <Text style={[styles.filePickerHint, { color: theme.textMuted }]}>
                        PDF, JPG, PNG, WEBP (máx. 5MB)
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.fileSelected, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                      <Ionicons name="document-attach" size={24} color="#10b981" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileName, { color: '#10b981' }]} numberOfLines={1}>
                          {archivo.name}
                        </Text>
                        <Text style={[styles.fileSize, { color: 'rgba(16, 185, 129, 0.8)' }]}>
                          {formatFileSize(archivo.size || 0)}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Comentario */}
              <View style={styles.comentarioSection}>
                <Text style={[styles.comentarioLabel, { color: theme.text }]}>
                  <Ionicons name="chatbox-outline" size={16} color={theme.accent} /> Comentario (Opcional)
                </Text>
                <TextInput
                  style={[styles.comentarioInput, {
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                  placeholder="Escribe un comentario sobre tu entrega..."
                  placeholderTextColor={theme.textMuted}
                  value={comentario}
                  onChangeText={setComentario}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Botones de Acción */}
            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: theme.border }]}
                onPress={() => setShowModalEntrega(false)}
                disabled={uploading}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, {
                  backgroundColor: uploading || (!archivo && !tareaSeleccionada?.id_entrega)
                    ? 'rgba(251, 191, 36, 0.3)'
                    : theme.accent
                }]}
                onPress={handleSubmitEntrega}
                disabled={uploading || (!archivo && !tareaSeleccionada?.id_entrega)}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color="#fff" />
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                      {tareaSeleccionada?.id_entrega ? 'Actualizar' : 'Entregar'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal
        visible={showConfirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDelete(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: theme.cardBg }]}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Confirmar Eliminación</Text>
            <Text style={[styles.confirmText, { color: theme.textSecondary }]}>
              ¿Estás seguro de eliminar esta entrega? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: theme.border }]}
                onPress={() => {
                  setShowConfirmDelete(false);
                  setEntregaToDelete(null);
                }}
              >
                <Text style={[styles.confirmButtonText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#ef4444' }]}
                onPress={handleEliminarEntrega}
              >
                <Text style={[styles.confirmButtonText, { color: '#fff' }]}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  statsContainer: {
    padding: 16,
  },
  promedioCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  promedioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  promedioLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  promedioValor: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  moduloCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  moduloHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  moduloInfo: {
    flex: 1,
  },
  moduloTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  moduloBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  moduloBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  moduloNombre: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  moduloTareas: {
    fontSize: 12,
  },
  tareasContainer: {
    padding: 16,
  },
  tareaCard: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  tareaHeader: {
    marginBottom: 12,
  },
  tareaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  estadoBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  estadoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tareaDesc: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  tareaInfo: {
    gap: 8,
    marginBottom: 12,
  },
  tareaInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tareaInfoText: {
    fontSize: 12,
  },
  calificacionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  calificacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calificacionLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  calificacionValor: {
    fontSize: 28,
    fontWeight: '700',
  },
  resultadoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resultadoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  comentarioDocente: {
    marginTop: 8,
  },
  comentarioDocenteLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  comentarioTexto: {
    fontSize: 13,
    lineHeight: 18,
  },
  tareaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  instruccionesCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  instruccionesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  instruccionesTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  instruccionesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fileSection: {
    marginBottom: 16,
  },
  fileLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  filePickerButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
  },
  filePickerContent: {
    alignItems: 'center',
    gap: 8,
  },
  filePickerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filePickerHint: {
    fontSize: 12,
  },
  fileSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  comentarioSection: {
    marginBottom: 16,
  },
  comentarioLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  comentarioInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  confirmIconContainer: {
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
