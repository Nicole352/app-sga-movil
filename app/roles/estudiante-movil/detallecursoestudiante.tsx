import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  StatusBar
} from 'react-native';
import { useGlobalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

interface Modulo {
  id_modulo: number;
  nombre: string;
  descripcion: string;
  total_tareas: number;
  estado?: string; // finalizado, activo
}

interface Tarea {
  id_tarea: number;
  titulo: string;
  descripcion: string;
  fecha_limite: string;
  nota_maxima: number;
  ponderacion: number;
  permite_archivo: boolean;
  formatos_permitidos: string;
  tamano_maximo_mb: number;
  categoria_nombre?: string;
  categoria_ponderacion?: number;
  entrega?: {
    id_entrega: number;
    archivo_nombre: string;
    archivo_url?: string;
    calificacion?: number;
    comentarios?: string;
    fecha_entrega: string;
    estado: string;
    fecha_calificacion?: string;
    calificador_nombres?: string;
    calificador_apellidos?: string;
  };
}

export default function DetalleCursoEstudiante() {
  const { id } = useGlobalSearchParams();
  const [darkMode, setDarkMode] = useState(false);
  const [curso, setCurso] = useState<any>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [tareasPorModulo, setTareasPorModulo] = useState<{ [key: number]: Tarea[] }>({});
  const [modulosExpandidos, setModulosExpandidos] = useState<{ [key: number]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingTarea, setUploadingTarea] = useState<number | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [previewFile, setPreviewFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size: number;
    id_tarea: number;
    id_modulo: number;
    action: 'upload' | 'edit';
    id_entrega?: number;
  } | null>(null);

  // Theme configuration matching Miaula
  const theme = darkMode
    ? {
      bg: '#0f172a',
      cardBg: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#fbbf24',
      primaryGradient: ['#f59e0b', '#d97706'] as const,
      danger: '#ef4444',
      success: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6'
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b',
      primaryGradient: ['#fbbf24', '#f59e0b'] as const,
      danger: '#dc2626',
      success: '#059669',
      blue: '#2563eb',
      purple: '#7c3aed'
    };

  useEffect(() => {
    loadDarkMode();
    loadUserData();
    eventEmitter.on('themeChanged', (isDark: boolean) => setDarkMode(isDark));
  }, []);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const loadUserData = async () => {
    const user = await getUserData();
    setUserData(user);
  };

  const loadDarkMode = async () => {
    const savedMode = await storage.getItem('dark_mode');
    if (savedMode !== null) setDarkMode(savedMode === 'true');
  };

  const socketEvents = {
    'nuevo_modulo': (data: any) => {
      if (data.id_curso === parseInt(id as string)) fetchData();
    },
    'nueva_tarea': (data: any) => {
      if (data.id_curso === parseInt(id as string)) fetchData();
    },
    'tarea_calificada': () => fetchData(),
    'modulo_cerrado': (data: any) => {
      if (data.id_curso === parseInt(id as string)) fetchData();
    },
    'modulo_reabierto': (data: any) => {
      if (data.id_curso === parseInt(id as string)) fetchData();
    }
  };

  useSocket(socketEvents, userData?.id_usuario);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const [cursoRes, modulosRes] = await Promise.all([
        fetch(`${API_URL}/cursos/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/modulos/curso/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (cursoRes.ok) {
        const cursoData = await cursoRes.json();
        setCurso(cursoData);
      }

      if (modulosRes.ok) {
        const modulosData = await modulosRes.json();
        const modulosArray = Array.isArray(modulosData?.modulos) ? modulosData.modulos :
          Array.isArray(modulosData) ? modulosData : [];
        setModulos(modulosArray);

        // Fetch tareas
        if (modulosArray.length > 0) {
          modulosArray.forEach((m: Modulo) => fetchTareasModulo(m.id_modulo));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTareasModulo = async (id_modulo: number) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/tareas/modulo/${id_modulo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const tareasArray = Array.isArray(data.tareas) ? data.tareas :
          Array.isArray(data) ? data : [];
        setTareasPorModulo(prev => ({ ...prev, [id_modulo]: tareasArray }));
      }
    } catch (error) {
      console.error('Error fetching tareas:', error);
    }
  };

  const toggleModulo = (id_modulo: number) => {
    setModulosExpandidos(prev => ({ ...prev, [id_modulo]: !prev[id_modulo] }));
  };

  // Group tasks logic
  const groupTareasByCategoria = (tareas: Tarea[]) => {
    const grupos: { [key: string]: Tarea[] } = {};
    tareas.forEach(t => {
      const key = t.categoria_nombre
        ? `${t.categoria_nombre}|${t.categoria_ponderacion}`
        : 'General|0';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(t);
    });
    return grupos;
  };

  // --- File Handling Functions (Same logic, updated UI triggers) ---
  const handleSelectFile = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    try {
      const fechaLimite = new Date(tarea.fecha_limite);
      if (fechaLimite < new Date() && action === 'upload') {
        Alert.alert('Aviso', 'La fecha límite ha pasado. Se marcará como entrega tardía.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => showFileOptions(tarea, id_modulo, action) }
        ]);
        return;
      }
      showFileOptions(tarea, id_modulo, action);
    } catch (e) { console.error(e); }
  };

  const showFileOptions = (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    Alert.alert('Seleccionar Archivo', 'Selecciona el origen', [
      { text: 'Cámara', onPress: () => pickImage(tarea, id_modulo, action, true) },
      { text: 'Galería', onPress: () => pickImage(tarea, id_modulo, action, false) },
      { text: 'Documento', onPress: () => pickDocument(tarea, id_modulo, action) },
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const pickImage = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit', useCamera: boolean) => {
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      processFile(result.assets[0], tarea, id_modulo, action);
    }
  };

  const pickDocument = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      processFile(result.assets[0], tarea, id_modulo, action);
    }
  };

  const processFile = (file: any, tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    // Validations
    if (tarea.formatos_permitidos) {
      const ext = file.uri.split('.').pop()?.toLowerCase();
      if (!tarea.formatos_permitidos.toLowerCase().includes(ext || '')) {
        Alert.alert('Formato inválido', `Permitidos: ${tarea.formatos_permitidos}`);
        return;
      }
    }
    const sizeMB = (file.size || 0) / (1024 * 1024);
    if (sizeMB > tarea.tamano_maximo_mb) {
      Alert.alert('Archivo muy pesado', `Máximo: ${tarea.tamano_maximo_mb}MB`);
      return;
    }

    setPreviewFile({
      uri: file.uri,
      name: file.name || 'archivo',
      type: file.mimeType || 'application/octet-stream',
      size: file.size || 0,
      id_tarea: tarea.id_tarea,
      id_modulo,
      action,
      id_entrega: tarea.entrega?.id_entrega
    });
  };

  const handleUpload = async () => {
    if (!previewFile) return;
    setUploadingTarea(previewFile.id_tarea);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('archivo', {
        uri: previewFile.uri,
        name: previewFile.name,
        type: previewFile.type
      } as any);

      let url = `${API_URL}/entregas`;
      let method = 'POST';

      if (previewFile.action === 'upload') {
        formData.append('id_tarea', previewFile.id_tarea.toString());
      } else {
        url += `/${previewFile.id_entrega}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` }, // Fetch handles multipart boundary automatically
        body: formData
      });

      if (res.ok) {
        Alert.alert('Éxito', 'Archivo subido correctamente');
        setPreviewFile(null);
        fetchTareasModulo(previewFile.id_modulo);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Fallo la subida');
      }
    } catch (e) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setUploadingTarea(null);
    }
  };

  const handleDelete = (id_entrega: number, id_modulo: number) => {
    Alert.alert('Eliminar', '¿Borrar entrega?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            const token = await getToken();
            await fetch(`${API_URL}/entregas/${id_entrega}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            fetchTareasModulo(id_modulo);
          } catch (e) { Alert.alert('Error', 'No se pudo eliminar'); }
        }
      }
    ]);
  };

  // Helper check for "Can Submit"
  const canSubmit = (fechaLimite: string) => {
    return new Date() <= new Date(fechaLimite);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Premium Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={darkMode ? ['#b45309', '#78350f'] : ['#fbbf24', '#d97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backButtonText}>Volver a Mis Cursos</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>{curso?.nombre}</Text>
              <Text style={styles.headerSubtitle}>{curso?.codigo_curso}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.accent} />}
      >
        {modulos.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.cardBg }]}>
            <Ionicons name="folder-open-outline" size={48} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, marginTop: 8 }}>No hay módulos aún</Text>
          </View>
        ) : (
          modulos.map((modulo, index) => (
            <Animated.View
              key={modulo.id_modulo}
              entering={FadeInDown.delay(100 * index).duration(400)}
              style={[styles.moduleCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            >
              <TouchableOpacity
                style={styles.moduleHeader}
                onPress={() => toggleModulo(modulo.id_modulo)}
                activeOpacity={0.7}
              >
                <View style={styles.moduleInfo}>
                  <Text style={[styles.moduleName, { color: theme.text }]}>{modulo.nombre}</Text>
                  <Text style={[styles.moduleCount, { color: theme.textSecondary }]}>
                    {modulo.total_tareas} tareas
                  </Text>
                </View>
                <Ionicons
                  name={modulosExpandidos[modulo.id_modulo] ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.accent}
                />
              </TouchableOpacity>

              {modulosExpandidos[modulo.id_modulo] && (
                <View style={styles.tasksContainer}>
                  {(!tareasPorModulo[modulo.id_modulo] || tareasPorModulo[modulo.id_modulo].length === 0) ? (
                    <Text style={[styles.noTasks, { color: theme.textMuted }]}>Sin tareas asignadas</Text>
                  ) : (
                    Object.entries(groupTareasByCategoria(tareasPorModulo[modulo.id_modulo])).map(([catKey, tareas]) => {
                      const [catNombre, catPond] = catKey.split('|');
                      return (
                        <View key={catKey} style={styles.categoryGroup}>
                          {catNombre !== 'General' && (
                            <View style={styles.categoryHeader}>
                              <Ionicons name="bookmark" size={12} color={theme.accent} />
                              <Text style={[styles.categoryTitle, { color: theme.textSecondary }]}>
                                {catNombre} <Text style={{ fontSize: 10, opacity: 0.7 }}>({catPond} pts)</Text>
                              </Text>
                            </View>
                          )}

                          {tareas.map(tarea => {
                            const isExpired = new Date(tarea.fecha_limite) < new Date();
                            const isSubmitted = !!tarea.entrega;
                            const isGraded = !!tarea.entrega?.calificacion;
                            const isModuleClosed = modulo.estado === 'finalizado';
                            const lateWarning = !isSubmitted && isExpired;

                            return (
                              <View key={tarea.id_tarea} style={[styles.taskCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderColor: theme.border }]}>
                                <View style={styles.taskHeader}>
                                  <Text style={[styles.taskTitle, { color: theme.text }]}>{tarea.titulo}</Text>
                                  {/* Status Badge */}
                                  {isSubmitted ? (
                                    <View style={[styles.badge, { backgroundColor: isGraded ? `${theme.success}20` : `${theme.accent}20` }]}>
                                      <Ionicons name={isGraded ? "checkmark-done" : "time"} size={10} color={isGraded ? theme.success : theme.accent} />
                                      <Text style={[styles.badgeText, { color: isGraded ? theme.success : theme.accent }]}>
                                        {isGraded ? 'CALIFICADO' : 'ENTREGADO'}
                                      </Text>
                                    </View>
                                  ) : (
                                    <View style={[styles.badge, { backgroundColor: `${theme.danger}15` }]}>
                                      <Ionicons name="alert-circle" size={10} color={theme.danger} />
                                      <Text style={[styles.badgeText, { color: theme.danger }]}>PENDIENTE</Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={[styles.taskDesc, { color: theme.textSecondary }]}>{tarea.descripcion}</Text>

                                <View style={styles.taskMetaRow}>
                                  {/* RED DATE LOGIC: If late and not submitted, color is danger */}
                                  <Text style={[styles.metaText, { color: lateWarning ? theme.danger : theme.textMuted }]}>
                                    <Ionicons name="calendar-outline" size={10} /> {new Date(tarea.fecha_limite).toLocaleDateString()}
                                  </Text>
                                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                                    Max: {Number(tarea.nota_maxima).toFixed(2)} pts
                                  </Text>
                                </View>

                                {/* WARNING BANNERS */}
                                {tarea.permite_archivo && !isSubmitted && (
                                  <>
                                    {isModuleClosed ? (
                                      <View style={[styles.warningBanner, { backgroundColor: 'rgba(156, 163, 175, 0.1)', borderColor: 'rgba(156, 163, 175, 0.3)' }]}>
                                        <Ionicons name="alert-circle" size={14} color={theme.textMuted} />
                                        <Text style={[styles.warningText, { color: theme.textMuted }]}>Módulo cerrado exitosamente - No se permiten más entregas</Text>
                                      </View>
                                    ) : lateWarning && (
                                      <View style={[styles.warningBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                                        <Ionicons name="alert-circle" size={14} color={theme.danger} />
                                        <Text style={[styles.warningText, { color: theme.danger }]}>Fecha límite vencida - La entrega será marcada como atrasada</Text>
                                      </View>
                                    )}
                                  </>
                                )}


                                {/* Interactive Section */}
                                <View style={[styles.actionFooter, { borderTopColor: theme.border }]}>
                                  {isSubmitted ? (
                                    <View style={styles.submittedInfo}>
                                      <Text style={[styles.submittedFile, { color: theme.text }]}>
                                        <Ionicons name="document-text" /> {tarea.entrega?.archivo_nombre}
                                      </Text>
                                      {isGraded && (
                                        <View style={styles.gradeContainer}>
                                          <Text style={[styles.gradeText, { color: theme.accent }]}>
                                            Nota: {tarea.entrega?.calificacion}/{tarea.nota_maxima}
                                          </Text>
                                          {tarea.entrega?.comentarios && (
                                            <Text style={[styles.commentText, { color: theme.textSecondary }]}>"{tarea.entrega.comentarios}"</Text>
                                          )}
                                        </View>
                                      )}
                                      {/* Edit/Delete Actions only if not graded and module active */}
                                      {!isGraded && !isModuleClosed && (
                                        <View style={styles.buttonGroup}>
                                          <TouchableOpacity onPress={() => handleSelectFile(tarea, modulo.id_modulo, 'edit')} style={styles.iconBtn}>
                                            <Ionicons name="create-outline" size={18} color={theme.accent} />
                                          </TouchableOpacity>
                                          <TouchableOpacity onPress={() => handleDelete(tarea.entrega!.id_entrega, modulo.id_modulo)} style={styles.iconBtn}>
                                            <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                  ) : (
                                    !isModuleClosed ? (
                                      <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => handleSelectFile(tarea, modulo.id_modulo, 'upload')}
                                      >
                                        <LinearGradient
                                          colors={['#fbbf24', '#f59e0b']}
                                          style={styles.uploadBtnGradient}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 1, y: 0 }}
                                        >
                                          <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                                          <Text style={styles.uploadBtnText}>Subir Tarea</Text>
                                        </LinearGradient>
                                      </TouchableOpacity>
                                    ) : (
                                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>Módulo cerrado</Text>
                                    )
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Upload Preview Modal */}
      <Modal visible={!!previewFile} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {previewFile?.action === 'upload' ? 'Confirmar Entrega' : 'Actualizar Archivo'}
            </Text>

            <View style={[styles.filePreviewCard, { backgroundColor: darkMode ? '#0f172a' : '#f1f5f9' }]}>
              <Ionicons name="document-attach" size={32} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color: theme.text }]}>{previewFile?.name}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>{(previewFile?.size || 0) / 1024 > 1024 ? `${((previewFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB` : `${((previewFile?.size || 0) / 1024).toFixed(2)} KB`}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPreviewFile(null)} style={[styles.modalBtn, { backgroundColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpload}
                style={[styles.modalBtn, { backgroundColor: theme.accent }]}
                disabled={!!uploadingTarea}
              >
                {uploadingTarea ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: -20,
    zIndex: 10
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 30,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  scrollContent: { padding: 16, paddingTop: 30, paddingBottom: 50 },
  emptyState: { padding: 40, alignItems: 'center', borderRadius: 16 },

  moduleCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between'
  },
  moduleInfo: { flex: 1 },
  moduleName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  moduleCount: { fontSize: 12 },

  tasksContainer: { padding: 16, paddingTop: 0 },
  noTasks: { textAlign: 'center', padding: 10, fontSize: 12 },

  categoryGroup: { marginBottom: 12 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  categoryTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  taskCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  taskTitle: { fontSize: 14, fontWeight: 'bold', flex: 1, marginRight: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  taskDesc: { fontSize: 12, marginBottom: 8, lineHeight: 16 },
  taskMetaRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  metaText: { fontSize: 11 },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10
  },
  warningText: { fontSize: 11, fontWeight: '600', flex: 1 },

  actionFooter: { paddingTop: 10, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  uploadBtnGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8
  },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  submittedInfo: { flex: 1 },
  submittedFile: { fontSize: 12, marginBottom: 4 },
  gradeContainer: { marginTop: 4, padding: 6, backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 6 },
  gradeText: { fontSize: 12, fontWeight: 'bold' },
  commentText: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },

  buttonGroup: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  iconBtn: { padding: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  filePreviewCard: { flexDirection: 'row', padding: 12, borderRadius: 12, gap: 12, alignItems: 'center', marginBottom: 20 },
  previewName: { fontSize: 14, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  headerContent: { width: '100%' }
});
