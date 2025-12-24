import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
  Platform,
  Image,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';

interface Entrega {
  id_entrega: number;
  id_estudiante: number;
  estudiante_nombre: string;
  estudiante_apellido: string;
  estudiante_identificacion?: string;
  archivo_nombre?: string;
  archivo_url?: string;
  archivo_public_id?: string;
  fecha_entrega: string;
  estado: string;
  calificacion?: number;
  comentario?: string;
  fecha_calificacion?: string;
}

interface ModalEntregasProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  id_tarea: number;
  nombre_tarea: string;
  nota_maxima: number;
  ponderacion: number;
}

const { width } = Dimensions.get('window');

export default function ModalEntregas({
  visible,
  onClose,
  onSuccess,
  id_tarea,
  nombre_tarea,
  nota_maxima,
  ponderacion,
}: ModalEntregasProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(false);
  const [notaInput, setNotaInput] = useState('');
  const [comentarioInput, setComentarioInput] = useState('');
  const [entregaSeleccionada, setEntregaSeleccionada] = useState<Entrega | null>(null);
  const [showCalificarModal, setShowCalificarModal] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'calificadas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [calificando, setCalificando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [archivoPreview, setArchivoPreview] = useState<{
    entrega: Entrega;
    url: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    loadDarkMode();
  }, []);

  useEffect(() => {
    if (visible && id_tarea) {
      fetchEntregas();
    }
  }, [visible, id_tarea]);

  const loadDarkMode = async () => {
    const mode = await getDarkMode();
    setDarkMode(mode);
  };

  const fetchEntregas = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch(`${API_URL}/entregas/tarea/${id_tarea}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.entregas && Array.isArray(data.entregas)) {
        const entregasConEstado = data.entregas.map((entrega: any) => ({
          ...entrega,
          estado: entrega.calificacion !== undefined && entrega.calificacion !== null ? 'calificado' : 'pendiente'
        }));
        setEntregas(entregasConEstado);
      } else {
        setEntregas([]);
      }
    } catch (error) {
      console.error('Error obteniendo entregas:', error);
      Alert.alert('Error', 'Error al cargar las entregas. Verifica que la tarea exista.');
      setEntregas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCalificar = async () => {
    if (!entregaSeleccionada) return;

    const nota = parseFloat(notaInput || '0');
    const comentario = comentarioInput || '';

    if (isNaN(nota) || nota < 0 || nota > nota_maxima) {
      Alert.alert('Error', `La nota debe estar entre 0 y ${nota_maxima}`);
      return;
    }

    try {
      setCalificando(true);
      const token = await getToken();

      const response = await fetch(`${API_URL}/entregas/${entregaSeleccionada.id_entrega}/calificar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nota,
          comentario_docente: comentario
        })
      });

      if (response.ok) {
        setShowCalificarModal(false);
        setEntregaSeleccionada(null);
        setNotaInput('');
        setComentarioInput('');
        setArchivoPreview(null);

        Alert.alert('Éxito', 'Tarea calificada exitosamente');
        await fetchEntregas();
        onSuccess();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Error al calificar');
      }
    } catch (error: any) {
      console.error('Error calificando:', error);
      Alert.alert('Error', 'Error al calificar');
    } finally {
      setCalificando(false);
    }
  };

  const handleVerArchivo = (entrega: Entrega) => {
    try {
      if (entrega.archivo_url) {
        const nombreArchivo = entrega.archivo_nombre || entrega.archivo_url;
        const extension = nombreArchivo?.split('.').pop()?.toLowerCase();
        let tipo = 'application/octet-stream';

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
          tipo = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        } else if (extension === 'pdf') {
          tipo = 'application/pdf';
        }

        setArchivoPreview({
          entrega,
          url: entrega.archivo_url || '',
          tipo
        });
      } else {
        Alert.alert('Info', 'El estudiante no adjuntó archivo (solo texto o entrega vacía).');
      }
    } catch (error) {
      console.error('Error cargando archivo:', error);
      Alert.alert('Error', 'Error al cargar el archivo');
    }
  };

  const handleDescargar = async (entrega: Entrega) => {
    try {
      if (entrega.archivo_url) {
        await Linking.openURL(entrega.archivo_url);
      } else {
        Alert.alert('Error', 'No hay archivo disponible');
      }
    } catch (error) {
      console.error('Error descargando archivo:', error);
      Alert.alert('Error', 'Error al abrir el archivo');
    }
  };

  const abrirModalCalificar = (entrega: Entrega) => {
    setEntregaSeleccionada(entrega);
    setNotaInput(entrega.calificacion?.toString() || '');
    setComentarioInput(entrega.comentario || '');
    setShowCalificarModal(true);
  };

  const calcularEstadisticas = () => {
    const total = entregas.length;
    const calificadas = entregas.filter(e => e.calificacion !== undefined && e.calificacion !== null).length;
    const pendientes = total - calificadas;
    const porcentaje = total > 0 ? Math.round((calificadas / total) * 100) : 0;
    return { total, calificadas, pendientes, porcentaje };
  };

  const filteredEntregas = entregas.filter(entrega => {
    if (filtro === 'pendientes' && (entrega.calificacion !== undefined)) return false;
    if (filtro === 'calificadas' && (entrega.calificacion === undefined)) return false;

    if (busqueda) {
      const term = busqueda.toLowerCase();
      return (
        entrega.estudiante_nombre.toLowerCase().includes(term) ||
        entrega.estudiante_apellido.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = calcularEstadisticas();

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f8fafc' : '#0f172a',
    textMuted: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    inputBg: darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          {/* === CONTENIDO PRINCIPAL (Lista) === */}
          <View style={{ flex: 1 }}>
            {/* Encabezado Premium */}
            <LinearGradient
              colors={darkMode ? ['#1e3a8a', '#1e40af'] : ['#2563eb', '#3b82f6']}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <View>
                  <Text style={styles.headerTitle}>Entregas de Tarea</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>{nombre_tarea}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

            </LinearGradient>

            {/* Fila de Tarjetas de Estadísticas */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.9)' : '#fff' }]}>
                <Text style={[styles.statValue, { color: theme.primary }]}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.9)' : '#fff' }]}>
                <Text style={[styles.statValue, { color: theme.warning }]}>{stats.pendientes}</Text>
                <Text style={styles.statLabel}>Pendientes</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.9)' : '#fff' }]}>
                <Text style={[styles.statValue, { color: theme.success }]}>{stats.porcentaje}%</Text>
                <Text style={styles.statLabel}>Completado</Text>
              </View>
            </View>

            {/* Filtros y Busqueda */}
            <View style={[styles.filtersSection, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <View style={[styles.searchBox, { backgroundColor: theme.inputBg }]}>
                <Ionicons name="search" size={18} color={theme.textMuted} />
                <TextInput
                  placeholder="Buscar estudiante..."
                  placeholderTextColor={theme.textMuted}
                  style={[styles.searchInput, { color: theme.text }]}
                  value={busqueda}
                  onChangeText={setBusqueda}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10, gap: 8 }}>
                {(['todas', 'pendientes', 'calificadas'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFiltro(f)}
                    style={[
                      styles.filterChip,
                      filtro === f && { backgroundColor: theme.primary, borderColor: theme.primary },
                      filtro !== f && { borderColor: theme.border, backgroundColor: 'transparent' }
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      filtro === f ? { color: '#fff' } : { color: theme.textMuted }
                    ]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Lista de Entregas */}
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
              ) : filteredEntregas.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={64} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No se encontraron entregas</Text>
                </View>
              ) : (
                filteredEntregas.map(entrega => (
                  <View key={entrega.id_entrega} style={[styles.entregaCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                        <Text style={styles.avatarText}>{entrega.estudiante_nombre.charAt(0)}{entrega.estudiante_apellido.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: theme.text }]}>{entrega.estudiante_apellido} {entrega.estudiante_nombre}</Text>
                        <Text style={[styles.dateText, { color: theme.textMuted }]}>
                          {new Date(entrega.fecha_entrega).toLocaleDateString()} • {new Date(entrega.fecha_entrega).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      {entrega.calificacion !== undefined ? (
                        <View style={[styles.gradeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                          <Text style={[styles.gradeText, { color: theme.success }]}>{entrega.calificacion}</Text>
                        </View>
                      ) : (
                        <View style={[styles.gradeBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                          <Ionicons name="time" size={12} color={theme.warning} />
                        </View>
                      )}
                    </View>

                    {/* Acciones */}
                    <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleVerArchivo(entrega)}
                      >
                        <Ionicons name={entrega.archivo_url ? "eye-outline" : "document-outline"} size={18} color={theme.textMuted} />
                        <Text style={[styles.actionText, { color: theme.textMuted }]}>
                          {entrega.archivo_url ? "Ver Archivo" : "Sin Archivo"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionPrimary, { backgroundColor: theme.primary }]}
                        onPress={() => abrirModalCalificar(entrega)}
                      >
                        <Ionicons name="create-outline" size={18} color="#fff" />
                        <Text style={[styles.actionText, { color: '#fff' }]}>
                          {entrega.calificacion !== undefined && entrega.calificacion !== null ? 'Editar Nota' : 'Calificar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* === SUPERPOSICIÓN DE VISTA PREVIA DE ARCHIVO (z-index 50) === */}
          {archivoPreview && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 50 }]}>
              <View style={styles.previewHeader}>
                <TouchableOpacity onPress={() => setArchivoPreview(null)} style={styles.closePreviewBtn}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Vista Previa</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => abrirModalCalificar(archivoPreview.entrega)}
                    style={[styles.downloadBtn, { backgroundColor: theme.primary, borderRadius: 20, paddingHorizontal: 15, flexDirection: 'row', gap: 5, alignItems: 'center' }]}
                  >
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      {archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null ? 'Editar Nota' : 'Calificar'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDescargar(archivoPreview.entrega)} style={styles.downloadBtn}>
                    <Ionicons name="download" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {archivoPreview.tipo.includes('image') ? (
                  <Image source={{ uri: archivoPreview.url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                ) : archivoPreview.tipo === 'application/pdf' ? (
                  <WebView source={{ uri: archivoPreview.url }} style={{ width: width, flex: 1 }} />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="document-text" size={64} color="#666" />
                    <Text style={{ color: '#fff', marginTop: 16 }}>Vista previa no disponible</Text>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: theme.primary, marginTop: 20, width: 200 }]}
                      onPress={() => handleDescargar(archivoPreview.entrega)}
                    >
                      <Text style={styles.saveButtonText}>Descargar Archivo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* === SUPERPOSICIÓN DE CALIFICACIÓN (z-index 100) === */}
          {showCalificarModal && (
            <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { zIndex: 100 }]}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {entregaSeleccionada?.calificacion !== undefined && entregaSeleccionada?.calificacion !== null ? 'Editar Calificación' : 'Calificar Entrega'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowCalificarModal(false)}>
                    <Ionicons name="close" size={24} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: theme.textMuted, marginBottom: 16 }}>
                  Estudiante: {entregaSeleccionada?.estudiante_apellido} {entregaSeleccionada?.estudiante_nombre}
                </Text>

                <Text style={[styles.label, { color: theme.text }]}>Nota (Max: {nota_maxima})</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={notaInput}
                  onChangeText={setNotaInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={[styles.label, { color: theme.text, marginTop: 12 }]}>Comentario (Opcional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border, height: 80 }]}
                  value={comentarioInput}
                  onChangeText={setComentarioInput}
                  multiline
                  placeholder="Comentario para el estudiante..."
                  placeholderTextColor={theme.textMuted}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleCalificar}
                  disabled={calificando}
                >
                  {calificando ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Calificación</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 70, // Increased to prevent stats from covering text
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    maxWidth: 200,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -45,
    marginBottom: 20,
    zIndex: 10,
  },
  statCard: {
    width: '30%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  filtersSection: {
    marginTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  entregaCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  actionPrimary: {
    borderLeftWidth: 0,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  closePreviewBtn: {
    padding: 8,
  },
  downloadBtn: {
    padding: 8,
  },
});
