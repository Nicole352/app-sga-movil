import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useGlobalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

interface Modulo {
  id_modulo: number;
  nombre: string;
  descripcion: string;
  total_tareas: number;
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
  entrega?: {
    id_entrega: number;
    archivo_nombre: string;
    archivo_url?: string;
    calificacion?: number;
    comentarios?: string;
    fecha_entrega: string;
    estado: string;
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
    loadUserData();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const loadUserData = async () => {
    const user = await getUserData();
    setUserData(user);
  };

  // Configurar eventos de WebSocket para actualizaciones en tiempo real
  const socketEvents = {
    'nuevo_modulo': (data: any) => {
      if (data.id_curso === parseInt(id as string)) {
        console.log('Nuevo módulo recibido:', data.nombre_modulo);
        fetchData();
      }
    },
    'nueva_tarea': (data: any) => {
      if (data.id_curso === parseInt(id as string)) {
        console.log('Nueva tarea recibida:', data.titulo_tarea);
        fetchData();
      }
    },
    'tarea_calificada': (data: any) => {
      console.log('Tarea calificada');
      fetchData();
    }
  };

  useSocket(socketEvents, userData?.id_usuario);

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

      console.log('Cargando curso:', id);

      // Obtener datos del curso
      const cursoResponse = await fetch(`${API_URL}/cursos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!cursoResponse.ok) {
        throw new Error('Error al cargar el curso');
      }
      
      const cursoData = await cursoResponse.json();
      console.log('Curso cargado:', cursoData);
      setCurso(cursoData);

      // Obtener módulos
      const modulosResponse = await fetch(`${API_URL}/modulos/curso/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!modulosResponse.ok) {
        console.log('⚠️ Error al cargar módulos, status:', modulosResponse.status);
        setModulos([]);
        return;
      }
      
      const modulosData = await modulosResponse.json();
      console.log('📦 Módulos recibidos:', modulosData);
      
      // Extraer el array de módulos del objeto de respuesta
      const modulosArray = Array.isArray(modulosData?.modulos) ? modulosData.modulos : 
                          Array.isArray(modulosData) ? modulosData : [];
      console.log('📦 Módulos array:', modulosArray.length, 'módulos');
      setModulos(modulosArray);

      // Obtener tareas de cada módulo
      if (modulosArray.length > 0) {
        for (const modulo of modulosArray) {
          await fetchTareasModulo(modulo.id_modulo);
        }
      }
    } catch (error) {
      console.error('💥 Error en fetchData:', error);
      Alert.alert('Error', 'No se pudo cargar el curso');
      setModulos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTareasModulo = async (id_modulo: number) => {
    try {
      const token = await getToken();
      console.log(`📡 Fetching tareas del módulo ${id_modulo} desde: ${API_URL}/tareas/modulo/${id_modulo}`);
      const response = await fetch(`${API_URL}/tareas/modulo/${id_modulo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`📊 Response status tareas módulo ${id_modulo}:`, response.status);
      
      if (!response.ok) {
        console.log(`⚠️ Error al cargar tareas del módulo ${id_modulo}`);
        setTareasPorModulo(prev => ({ ...prev, [id_modulo]: [] }));
        return;
      }
      
      const data = await response.json();
      console.log(`📦 Data completa del módulo ${id_modulo}:`, JSON.stringify(data, null, 2));
      
      // El backend retorna { success: true, tareas: [...] }
      const tareasArray = Array.isArray(data.tareas) ? data.tareas :
        Array.isArray(data) ? data : [];
      console.log(`📝 Tareas del módulo ${id_modulo}:`, tareasArray.length);
      setTareasPorModulo(prev => ({ ...prev, [id_modulo]: tareasArray }));
    } catch (error) {
      console.error('Error al cargar tareas:', error);
      setTareasPorModulo(prev => ({ ...prev, [id_modulo]: [] }));
    }
  };

  const toggleModulo = (id_modulo: number) => {
    setModulosExpandidos(prev => ({ ...prev, [id_modulo]: !prev[id_modulo] }));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSelectFile = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    try {
      // Verificar si la fecha límite ya pasó
      const fechaLimite = new Date(tarea.fecha_limite);
      const ahora = new Date();
      const estaVencida = fechaLimite < ahora;

      if (estaVencida && action === 'upload') {
        Alert.alert(
          'Fecha límite vencida',
          'La fecha límite de esta tarea ya pasó. La entrega será marcada como atrasada.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => handleFileOptions(tarea, id_modulo, action) }
          ]
        );
        return;
      }

      handleFileOptions(tarea, id_modulo, action);
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleFileOptions = (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    Alert.alert(
      'Seleccionar archivo',
      'Elige una opción',
      [
        { text: 'Cámara', onPress: () => selectFromCamera(tarea, id_modulo, action) },
        { text: 'Galería', onPress: () => selectFromGallery(tarea, id_modulo, action) },
        { text: 'Documentos', onPress: () => selectFromDocuments(tarea, id_modulo, action) },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const selectFromCamera = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Error', 'Se necesita permiso para la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      processFile(result.assets[0], tarea, id_modulo, action);
    }
  };

  const selectFromGallery = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      processFile(result.assets[0], tarea, id_modulo, action);
    }
  };

  const selectFromDocuments = async (tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        processFile(result.assets[0], tarea, id_modulo, action);
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const processFile = (file: any, tarea: Tarea, id_modulo: number, action: 'upload' | 'edit') => {
    // Validar formato si está especificado
    if (tarea.formatos_permitidos) {
      const formatosPermitidos = tarea.formatos_permitidos.split(',').map(f => f.trim().toLowerCase());
      const extension = file.name?.split('.').pop()?.toLowerCase() || file.uri?.split('.').pop()?.toLowerCase();
      
      if (extension && !formatosPermitidos.includes(extension)) {
        Alert.alert(
          'Formato no permitido',
          `Solo se permiten archivos: ${tarea.formatos_permitidos.toUpperCase()}\n\nTu archivo es: .${extension?.toUpperCase()}`
        );
        return;
      }
    }

    // Validar tamaño
    const fileSize = file.size || file.fileSize || 0;
    const sizeMB = fileSize / (1024 * 1024);
    if (sizeMB > tarea.tamano_maximo_mb) {
      Alert.alert(
        'Archivo muy grande',
        `El archivo no debe superar ${tarea.tamano_maximo_mb}MB\n\nTu archivo pesa: ${sizeMB.toFixed(2)}MB`
      );
      return;
    }

    // Mostrar preview
    setPreviewFile({
      uri: file.uri,
      name: file.name || file.fileName || `archivo.${file.uri?.split('.').pop()}`,
      type: file.mimeType || file.type || 'application/octet-stream',
      size: fileSize,
      id_tarea: tarea.id_tarea,
      id_modulo,
      action,
      id_entrega: tarea.entrega?.id_entrega,
    });
  };

  const handleUploadFile = async () => {
    if (!previewFile) return;

    try {
      setUploadingTarea(previewFile.id_tarea);
      const token = await getToken();

      const formData = new FormData();
      
      // Crear el objeto file para FormData
      const fileToUpload: any = {
        uri: previewFile.uri,
        name: previewFile.name,
        type: previewFile.type,
      };

      formData.append('archivo', fileToUpload);

      let response;
      if (previewFile.action === 'upload') {
        formData.append('id_tarea', previewFile.id_tarea.toString());
        response = await fetch(`${API_URL}/entregas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        response = await fetch(`${API_URL}/entregas/${previewFile.id_entrega}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
      }

      if (response.ok) {
        Alert.alert(
          'Éxito',
          previewFile.action === 'upload' ? 'Tarea entregada correctamente' : 'Tarea actualizada correctamente'
        );
        await fetchTareasModulo(previewFile.id_modulo);
        setPreviewFile(null);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'No se pudo subir el archivo');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Error al subir el archivo');
    } finally {
      setUploadingTarea(null);
    }
  };

  const handleDeleteEntrega = (id_entrega: number, id_modulo: number) => {
    Alert.alert(
      'Eliminar entrega',
      '¿Estás seguro de que quieres eliminar esta entrega?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/entregas/${id_entrega}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                Alert.alert('Éxito', 'Entrega eliminada correctamente');
                await fetchTareasModulo(id_modulo);
              } else {
                Alert.alert('Error', 'No se pudo eliminar la entrega');
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'Error al eliminar la entrega');
            }
          },
        },
      ]
    );
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
      </View>
    );
  }

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
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={2}>
              {curso?.nombre}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {curso?.codigo_curso}
            </Text>
          </View>
        </View>

        {/* Módulos y Tareas */}
        <View style={styles.content}>
          {modulos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Ionicons name="folder-open-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.text }]}>No hay módulos disponibles</Text>
            </View>
          ) : (
            modulos.map((modulo) => (
              <View key={modulo.id_modulo} style={[styles.moduloCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.moduloHeader}
                  onPress={() => toggleModulo(modulo.id_modulo)}
                  activeOpacity={0.7}
                >
                  <View style={styles.moduloInfo}>
                    <Text style={[styles.moduloNombre, { color: theme.text }]}>{modulo.nombre}</Text>
                    <Text style={[styles.moduloDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {modulo.descripcion}
                    </Text>
                  </View>
                  <Ionicons
                    name={modulosExpandidos[modulo.id_modulo] ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={theme.accent}
                  />
                </TouchableOpacity>

                {modulosExpandidos[modulo.id_modulo] && (
                  <View style={styles.tareasContainer}>
                    {tareasPorModulo[modulo.id_modulo]?.length === 0 ? (
                      <Text style={[styles.noTareas, { color: theme.textMuted }]}>No hay tareas en este módulo</Text>
                    ) : (
                      tareasPorModulo[modulo.id_modulo]?.map((tarea) => {
                        const fechaLimite = new Date(tarea.fecha_limite);
                        const ahora = new Date();
                        const estaVencida = fechaLimite < ahora && !tarea.entrega;
                        
                        return (
                        <View key={tarea.id_tarea} style={[
                          styles.tareaCard, 
                          { borderColor: estaVencida ? 'rgba(239, 68, 68, 0.3)' : theme.border }
                        ]}>
                          <Text style={[styles.tareaTitulo, { color: theme.text }]}>{tarea.titulo}</Text>
                          <Text style={[styles.tareaDesc, { color: theme.textSecondary }]} numberOfLines={3}>
                            {tarea.descripcion}
                          </Text>
                          
                          <View style={styles.tareaInfo}>
                            <View style={styles.tareaInfoItem}>
                              <Ionicons name="calendar" size={14} color={estaVencida ? '#ef4444' : theme.textMuted} />
                              <Text style={[styles.tareaInfoText, { color: estaVencida ? '#ef4444' : theme.textMuted }]}>
                                {new Date(tarea.fecha_limite).toLocaleDateString('es-ES')}
                                {estaVencida && ' (Vencida)'}
                              </Text>
                            </View>
                            <View style={styles.tareaInfoItem}>
                              <Ionicons name="document-text" size={14} color={theme.textMuted} />
                              <Text style={[styles.tareaInfoText, { color: theme.textMuted }]}>
                                Nota: {Number(tarea.nota_maxima).toFixed(2)} | Peso: {tarea.ponderacion}pts
                              </Text>
                            </View>
                          </View>
                          
                          {/* Alerta de fecha vencida */}
                          {estaVencida && (
                            <View style={[styles.alertaVencida, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                              <Ionicons name="alert-circle" size={16} color="#ef4444" />
                              <Text style={[styles.alertaVencidaText, { color: '#ef4444' }]}>
                                Fecha límite vencida - La entrega será marcada como atrasada
                              </Text>
                            </View>
                          )}

                          {/* Estado de entrega */}
                          {tarea.entrega ? (
                            <View style={[styles.entregaInfo, { backgroundColor: theme.bg }]}>
                              <View style={styles.entregaHeader}>
                                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                <Text style={[styles.entregaStatus, { color: '#10b981' }]}>Entregado</Text>
                              </View>
                              <Text style={[styles.entregaArchivo, { color: theme.textSecondary }]}>
                                📎 {tarea.entrega.archivo_nombre}
                              </Text>
                              <Text style={[styles.entregaFecha, { color: theme.textMuted }]}>
                                {new Date(tarea.entrega.fecha_entrega).toLocaleString('es-ES')}
                              </Text>
                              
                              {tarea.entrega.calificacion !== null && tarea.entrega.calificacion !== undefined ? (
                                <View style={[styles.calificacionBadge, { backgroundColor: theme.accent + '20' }]}>
                                  <Text style={[styles.calificacionText, { color: theme.accent }]}>
                                    Calificación: {tarea.entrega.calificacion}/{tarea.nota_maxima}
                                  </Text>
                                  {tarea.entrega.comentarios && (
                                    <Text style={[styles.comentarios, { color: theme.textSecondary }]}>
                                      💬 {tarea.entrega.comentarios}
                                    </Text>
                                  )}
                                </View>
                              ) : (
                                <Text style={[styles.pendienteCalificar, { color: '#f59e0b' }]}>
                                  ⏳ Pendiente de calificar
                                </Text>
                              )}

                              {/* Botones de acción */}
                              <View style={styles.entregaActions}>
                                <TouchableOpacity
                                  style={[styles.actionButton, { backgroundColor: theme.accent }]}
                                  onPress={() => handleSelectFile(tarea, modulo.id_modulo, 'edit')}
                                  disabled={uploadingTarea === tarea.id_tarea}
                                >
                                  <Ionicons name="create" size={16} color="#fff" />
                                  <Text style={styles.actionButtonText}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                                  onPress={() => handleDeleteEntrega(tarea.entrega!.id_entrega, modulo.id_modulo)}
                                >
                                  <Ionicons name="trash" size={16} color="#fff" />
                                  <Text style={styles.actionButtonText}>Eliminar</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : tarea.permite_archivo ? (
                            <View>
                              <TouchableOpacity
                                style={[styles.uploadButton, { backgroundColor: theme.accent }]}
                                onPress={() => handleSelectFile(tarea, modulo.id_modulo, 'upload')}
                                disabled={uploadingTarea === tarea.id_tarea}
                              >
                                {uploadingTarea === tarea.id_tarea ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                                    <Text style={styles.uploadButtonText}>Subir archivo</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                              <Text style={[styles.formatosPermitidos, { color: theme.textMuted }]}>
                                Formatos: {tarea.formatos_permitidos.toUpperCase()} • Máx: {tarea.tamano_maximo_mb}MB
                              </Text>
                            </View>
                          ) : (
                            <Text style={[styles.noArchivoText, { color: theme.textMuted }]}>
                              Esta tarea no requiere archivo
                            </Text>
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

      {/* Modal de preview de archivo */}
      <Modal
        visible={previewFile !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewFile(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {previewFile?.action === 'upload' ? 'Subir archivo' : 'Actualizar archivo'}
              </Text>
              <TouchableOpacity onPress={() => setPreviewFile(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {previewFile && (
              <View style={styles.filePreview}>
                {/* Icono del archivo */}
                <View style={[styles.fileIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="document" size={48} color={theme.accent} />
                </View>

                {/* Info del archivo */}
                <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={2}>
                  {previewFile.name}
                </Text>
                <Text style={[styles.fileSize, { color: theme.textSecondary }]}>
                  {formatFileSize(previewFile.size)}
                </Text>

                {/* Botones */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.accent }]}
                    onPress={handleUploadFile}
                    disabled={uploadingTarea !== null}
                  >
                    {uploadingTarea !== null ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.modalButtonText}>
                          {previewFile.action === 'upload' ? 'Subir' : 'Actualizar'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: theme.textMuted }]}
                    onPress={() => setPreviewFile(null)}
                    disabled={uploadingTarea !== null}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
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
  },
  moduloInfo: {
    flex: 1,
  },
  moduloNombre: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  moduloDesc: {
    fontSize: 13,
  },
  tareasContainer: {
    padding: 16,
    paddingTop: 0,
  },
  noTareas: {
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  tareaCard: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  tareaTitulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  tareaDesc: {
    fontSize: 13,
    marginBottom: 12,
  },
  tareaInfo: {
    flexDirection: 'row',
    gap: 16,
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
  entregaInfo: {
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  entregaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entregaStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  entregaArchivo: {
    fontSize: 12,
  },
  calificacionBadge: {
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  calificacionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noArchivoText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  alertaVencida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  alertaVencidaText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  formatosPermitidos: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
  entregaFecha: {
    fontSize: 11,
  },
  pendienteCalificar: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  comentarios: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  entregaActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filePreview: {
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  fileSize: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
