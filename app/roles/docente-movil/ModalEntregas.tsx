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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
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
      console.error('Error fetching entregas:', error);
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
        setArchivoPreview(null); // Cerrar también el preview

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
    console.log('📂 handleVerArchivo llamado');
    console.log('📄 Entrega:', entrega);
    console.log('🔗 URL:', entrega.archivo_url);

    try {
      if (entrega.archivo_url) {
        // Determinar tipo de archivo por extensión
        const nombreArchivo = entrega.archivo_nombre || entrega.archivo_url;
        const extension = nombreArchivo?.split('.').pop()?.toLowerCase();
        let tipo = 'application/octet-stream';

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
          tipo = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        } else if (extension === 'pdf') {
          tipo = 'application/pdf';
        }

        console.log('📋 Tipo detectado:', tipo);
        console.log('✅ Abriendo preview...');

        setArchivoPreview({
          entrega,
          url: entrega.archivo_url || '',
          tipo
        });
      } else {
        console.log('❌ No hay archivo_url');
        Alert.alert('Error', 'No hay archivo disponible');
      }
    } catch (error) {
      console.error('❌ Error cargando archivo:', error);
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

  const exportarExcel = async () => {
    try {
      setExportando(true);

      // Calcular estadísticas
      const totalEntregas = entregas.length;
      const calificadas = entregas.filter(e => e.calificacion !== undefined && e.calificacion !== null).length;
      const pendientes = totalEntregas - calificadas;
      const aprobadas = entregas.filter(e => (e.calificacion || 0) >= 7).length;
      const promedioGeneral = calificadas > 0
        ? (entregas.reduce((sum, e) => sum + (e.calificacion || 0), 0) / calificadas).toFixed(2)
        : '0.00';

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // HOJA 1: Entregas
      const wsData: any[][] = [];

      // Encabezados
      wsData.push(['#', 'Apellido', 'Nombre', 'Identificación', 'Fecha Entrega', 'Calificación', 'Estado', 'Comentario']);

      // Datos de entregas
      entregas.forEach((entrega, index) => {
        const fecha = new Date(entrega.fecha_entrega).toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const calificacion = entrega.calificacion !== undefined && entrega.calificacion !== null
          ? entrega.calificacion
          : '-';
        const estado = entrega.calificacion !== undefined && entrega.calificacion !== null
          ? 'Calificada'
          : 'Pendiente';
        const comentario = entrega.comentario || 'Sin comentario';

        wsData.push([
          index + 1,
          entrega.estudiante_apellido,
          entrega.estudiante_nombre,
          entrega.estudiante_identificacion || entrega.id_estudiante,
          fecha,
          calificacion,
          estado,
          comentario
        ]);
      });

      // Agregar filas vacías
      wsData.push([]);
      wsData.push([]);

      // RESUMEN ESTADÍSTICO
      wsData.push(['RESUMEN ESTADÍSTICO']);
      wsData.push(['Total de Entregas', totalEntregas]);
      wsData.push(['Tareas Calificadas', calificadas]);
      wsData.push(['Tareas Pendientes', pendientes]);
      wsData.push(['Tareas Aprobadas (≥7.0)', aprobadas]);
      wsData.push(['Promedio General', promedioGeneral]);

      // Crear hoja
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 20 }, // Apellido
        { wch: 20 }, // Nombre
        { wch: 15 }, // Identificación
        { wch: 18 }, // Fecha
        { wch: 12 }, // Calificación
        { wch: 12 }, // Estado
        { wch: 40 }, // Comentario
      ];

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Entregas');

      // Generar archivo
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      // Limpiar nombre para el archivo
      const limpiarNombre = (texto: string) => {
        return texto
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
      };

      const tareaNombre = limpiarNombre(nombre_tarea);
      const fecha = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Entregas_${tareaNombre}_${fecha}.xlsx`;

      // Guardar archivo usando la nueva API
      const file = new FileSystem.File(FileSystem.Paths.cache, nombreArchivo);
      await file.create();
      await file.write(wbout, { encoding: 'base64' });

      // Compartir archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar Entregas a Excel',
          UTI: 'com.microsoft.excel.xlsx'
        });
        Alert.alert('Éxito', 'Archivo Excel exportado correctamente');
      } else {
        Alert.alert('Error', 'No se puede compartir archivos en este dispositivo');
      }
    } catch (error) {
      console.error('Error exportando Excel:', error);
      Alert.alert('Error', 'Error al exportar el archivo Excel');
    } finally {
      setExportando(false);
    }
  };

  const abrirModalCalificar = (entrega: Entrega) => {
    console.log('📝 Abriendo modal de calificación');
    console.log('👤 Entrega:', entrega);
    setEntregaSeleccionada(entrega);
    setNotaInput(entrega.calificacion?.toString() || '');
    setComentarioInput(entrega.comentario || '');
    setShowCalificarModal(true);
    console.log('✅ showCalificarModal = true');
  };

  const cerrarModalCalificar = () => {
    setShowCalificarModal(false);
    setArchivoPreview(null); // También cerrar el preview
  };

  const calcularEstadisticas = () => {
    const total = entregas.length;
    const calificadas = entregas.filter(e => e.calificacion !== undefined && e.calificacion !== null).length;
    const pendientes = total - calificadas;
    const porcentaje = total > 0 ? Math.round((calificadas / total) * 100) : 0;
    return { total, calificadas, pendientes, porcentaje };
  };

  const filteredEntregas = entregas.filter(entrega => {
    // Aplicar filtro
    if (filtro === 'pendientes' && (entrega.calificacion !== undefined && entrega.calificacion !== null)) {
      return false;
    }
    if (filtro === 'calificadas' && (entrega.calificacion === undefined || entrega.calificacion === null)) {
      return false;
    }

    // Aplicar búsqueda
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
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    accent: '#3b82f6',
    inputBg: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    rowBg: darkMode ? 'rgba(255,255,255,0.02)' : '#ffffff',
  };

  return (
    <>
      {/* Modal Principal de Entregas */}
      <Modal
        visible={visible && !archivoPreview && !showCalificarModal}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <View style={styles.headerLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name="document-text" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    Entregas de Tarea
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {nombre_tarea}
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={exportarExcel}
                  style={[styles.exportButton, {
                    backgroundColor: exportando ? 'rgba(34, 197, 94, 0.6)' : '#22c55e',
                    opacity: exportando ? 0.7 : 1
                  }]}
                  disabled={exportando || entregas.length === 0}
                >
                  {exportando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="document-text" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Estadísticas */}
            <View style={[styles.statsContainer, {
              backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)'
            }]}>
              <View style={styles.statsHeader}>
                <Ionicons name="bar-chart" size={20} color={theme.accent} />
                <Text style={[styles.statsTitle, { color: theme.text }]}>
                  Resumen de Entregas
                </Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statCard, {
                  backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: 'rgba(59, 130, 246, 0.2)'
                }]}>
                  <View style={[styles.statIcon, { backgroundColor: '#3b82f6' }]}>
                    <Ionicons name="people" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
                </View>

                <View style={[styles.statCard, {
                  backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)',
                  borderColor: 'rgba(251, 191, 36, 0.2)'
                }]}>
                  <View style={[styles.statIcon, { backgroundColor: '#fbbf24' }]}>
                    <Ionicons name="time" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.statValue, { color: '#fbbf24' }]}>{stats.pendientes}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pendientes</Text>
                </View>

                <View style={[styles.statCard, {
                  backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                  borderColor: 'rgba(16, 185, 129, 0.2)'
                }]}>
                  <View style={[styles.statIcon, { backgroundColor: '#10b981' }]}>
                    <Ionicons name="checkmark-done" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.calificadas}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Calificadas</Text>
                </View>

                <View style={[styles.statCard, {
                  backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }]}>
                  <View style={[styles.statIcon, { backgroundColor: '#10b981' }]}>
                    <Ionicons name="trophy" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.porcentaje}%</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Completado</Text>
                </View>
              </View>
            </View>

            {/* Filtros y Búsqueda */}
            <View style={styles.filtersContainer}>
              <View style={[styles.searchContainer, {
                backgroundColor: theme.inputBg,
                borderColor: theme.border
              }]}>
                <Ionicons name="search" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar estudiante..."
                  placeholderTextColor={theme.textMuted}
                  value={busqueda}
                  onChangeText={setBusqueda}
                />
              </View>

              <View style={styles.filterButtons}>
                <TouchableOpacity
                  style={[styles.filterButton, {
                    backgroundColor: filtro === 'todas'
                      ? (darkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)')
                      : 'transparent',
                    borderColor: filtro === 'todas' ? '#3b82f6' : theme.border
                  }]}
                  onPress={() => setFiltro('todas')}
                >
                  <Ionicons
                    name="document-text"
                    size={16}
                    color={filtro === 'todas' ? '#3b82f6' : theme.textSecondary}
                  />
                  <Text style={[styles.filterText, {
                    color: filtro === 'todas' ? '#3b82f6' : theme.textSecondary
                  }]}>
                    Todas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterButton, {
                    backgroundColor: filtro === 'pendientes'
                      ? (darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.1)')
                      : 'transparent',
                    borderColor: filtro === 'pendientes' ? '#fbbf24' : theme.border
                  }]}
                  onPress={() => setFiltro('pendientes')}
                >
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={filtro === 'pendientes' ? '#fbbf24' : theme.textSecondary}
                  />
                  <Text style={[styles.filterText, {
                    color: filtro === 'pendientes' ? '#fbbf24' : theme.textSecondary
                  }]}>
                    Pendientes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterButton, {
                    backgroundColor: filtro === 'calificadas'
                      ? (darkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)')
                      : 'transparent',
                    borderColor: filtro === 'calificadas' ? '#10b981' : theme.border
                  }]}
                  onPress={() => setFiltro('calificadas')}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={filtro === 'calificadas' ? '#10b981' : theme.textSecondary}
                  />
                  <Text style={[styles.filterText, {
                    color: filtro === 'calificadas' ? '#10b981' : theme.textSecondary
                  }]}>
                    Calificadas
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista de Entregas */}
            <ScrollView style={styles.entregasList} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.accent} />
                  <Text style={[styles.loadingText, { color: theme.text }]}>
                    Cargando entregas...
                  </Text>
                </View>
              ) : filteredEntregas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No hay entregas que coincidan con los filtros
                  </Text>
                </View>
              ) : (
                filteredEntregas.map((entrega) => (
                  <View
                    key={entrega.id_entrega}
                    style={[styles.entregaCard, {
                      backgroundColor: theme.rowBg,
                      borderColor: theme.border
                    }]}
                  >
                    {/* Estudiante */}
                    <View style={styles.entregaHeader}>
                      <View style={[styles.avatarContainer, {
                        backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
                      }]}>
                        <Ionicons name="person" size={16} color="#3b82f6" />
                      </View>
                      <View style={styles.estudianteInfo}>
                        <Text style={[styles.estudianteNombre, { color: theme.text }]}>
                          {entrega.estudiante_apellido}, {entrega.estudiante_nombre}
                        </Text>
                        <Text style={[styles.estudianteCI, { color: theme.textSecondary }]}>
                          CI: {entrega.estudiante_identificacion || entrega.id_estudiante}
                        </Text>
                      </View>
                    </View>

                    {/* Fecha y Estado */}
                    <View style={styles.entregaDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar" size={14} color={theme.textSecondary} />
                        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                          {new Date(entrega.fecha_entrega).toLocaleDateString('es-ES')}
                        </Text>
                      </View>

                      {entrega.calificacion !== undefined && entrega.calificacion !== null ? (
                        <View style={[styles.badge, styles.badgeCalificada]}>
                          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                          <Text style={styles.badgeTextCalificada}>Calificada</Text>
                        </View>
                      ) : (
                        <View style={[styles.badge, styles.badgePendiente]}>
                          <Ionicons name="alert-circle" size={14} color="#fbbf24" />
                          <Text style={styles.badgeTextPendiente}>Pendiente</Text>
                        </View>
                      )}
                    </View>

                    {/* Calificación */}
                    {entrega.calificacion !== undefined && entrega.calificacion !== null ? (
                      <View style={[styles.calificacionContainer, {
                        backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                        borderColor: 'rgba(16, 185, 129, 0.2)'
                      }]}>
                        <Ionicons name="trophy" size={14} color="#10b981" />
                        <Text style={styles.calificacionText}>
                          {entrega.calificacion}/{nota_maxima}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.sinCalificar, { color: theme.textMuted }]}>
                        Sin calificar
                      </Text>
                    )}

                    {/* Acciones */}
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonPrimary]}
                        onPress={() => handleVerArchivo(entrega)}
                      >
                        <Ionicons name="eye" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Ver tarea</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, {
                          backgroundColor: entrega.calificacion !== undefined && entrega.calificacion !== null
                            ? (darkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)')
                            : (darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'),
                          borderColor: entrega.calificacion !== undefined && entrega.calificacion !== null ? '#3b82f6' : '#10b981'
                        }]}
                        onPress={() => abrirModalCalificar(entrega)}
                      >
                        <Ionicons
                          name={entrega.calificacion !== undefined && entrega.calificacion !== null ? "create" : "trophy"}
                          size={18}
                          color={entrega.calificacion !== undefined && entrega.calificacion !== null ? '#3b82f6' : '#10b981'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Previsualización */}
      {archivoPreview && !showCalificarModal && (() => {
        console.log('🎬 Renderizando modal de preview');
        console.log('📦 archivoPreview:', archivoPreview);
        return (
          <Modal
            visible={true}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setArchivoPreview(null)}
          >
            <View style={styles.previewOverlay}>
              <View style={[styles.previewContent, { backgroundColor: theme.cardBg }]}>
                {/* Header */}
                <View style={[styles.previewHeader, { borderBottomColor: theme.border }]}>
                  <View style={styles.previewHeaderLeft}>
                    <View style={styles.previewIconContainer}>
                      <Ionicons name="document-text" size={16} color="#fff" />
                    </View>
                    <View>
                      <Text style={[styles.previewTitle, { color: theme.text }]}>
                        Vista Previa del Archivo
                      </Text>
                      <Text style={[styles.previewSubtitle, { color: theme.textSecondary }]}>
                        {archivoPreview.entrega.estudiante_apellido} {archivoPreview.entrega.estudiante_nombre}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setArchivoPreview(null)}>
                    <Ionicons name="close" size={20} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* Info del archivo */}
                <View style={[styles.previewFileInfo, {
                  backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: 'rgba(59, 130, 246, 0.2)'
                }]}>
                  <Ionicons name="document-text" size={18} color="#3b82f6" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewFileName, { color: theme.text }]}>
                      {archivoPreview.entrega.archivo_nombre}
                    </Text>
                    <Text style={[styles.previewFileDate, { color: theme.textMuted }]}>
                      {new Date(archivoPreview.entrega.fecha_entrega).toLocaleDateString('es-ES')} {' '}
                      {new Date(archivoPreview.entrega.fecha_entrega).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                {/* Vista previa */}
                <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContentContainer}>
                  {archivoPreview.tipo.startsWith('image/') ? (
                    <Image
                      source={{ uri: archivoPreview.url }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  ) : archivoPreview.tipo === 'application/pdf' ? (
                    <WebView
                      source={{ uri: archivoPreview.url }}
                      style={styles.previewWebView}
                    />
                  ) : (
                    <View style={styles.previewNoSupport}>
                      <Ionicons name="document-text-outline" size={80} color={theme.textMuted} />
                      <Text style={[styles.previewNoSupportText, { color: theme.textMuted }]}>
                        No se puede previsualizar este tipo de archivo
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Footer con botones */}
                <View style={[styles.previewFooter, { borderTopColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.previewButton, styles.previewButtonSecondary, { borderColor: theme.border }]}
                    onPress={() => setArchivoPreview(null)}
                  >
                    <Text style={[styles.previewButtonText, { color: theme.text }]}>Cerrar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.previewButton, styles.previewButtonPrimary, { backgroundColor: '#3b82f6' }]}
                    onPress={() => handleDescargar(archivoPreview.entrega)}
                  >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={[styles.previewButtonText, { color: '#fff' }]}>Descargar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.previewButton, styles.previewButtonPrimary, {
                      backgroundColor: archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null
                        ? (darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)')
                        : '#06b6d4',
                      borderColor: archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null
                        ? '#3b82f6'
                        : 'transparent',
                      borderWidth: archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null ? 1 : 0
                    }]}
                    onPress={() => {
                      abrirModalCalificar(archivoPreview.entrega);
                    }}
                  >
                    <Ionicons name="trophy" size={16} color={
                      archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null
                        ? '#3b82f6'
                        : '#fff'
                    } />
                    <Text style={[styles.previewButtonText, {
                      color: archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null
                        ? '#3b82f6'
                        : '#fff'
                    }]}>
                      {archivoPreview.entrega.calificacion !== undefined && archivoPreview.entrega.calificacion !== null
                        ? 'Editar Calificación'
                        : 'Calificar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Modal de Calificación */}
      {showCalificarModal && entregaSeleccionada && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          onRequestClose={cerrarModalCalificar}
        >
          <View style={styles.calificarOverlay}>
            <View style={[styles.calificarContent, { backgroundColor: theme.cardBg }]}>
              <View style={[styles.calificarHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.calificarTitle, { color: theme.text }]}>
                  {entregaSeleccionada.calificacion !== undefined && entregaSeleccionada.calificacion !== null
                    ? 'Editar Calificación'
                    : 'Calificar Tarea'}
                </Text>
                <TouchableOpacity onPress={cerrarModalCalificar}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.calificarBody} showsVerticalScrollIndicator={false}>
                <View style={styles.estudianteCard}>
                  <View style={[styles.avatarLarge, {
                    backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'
                  }]}>
                    <Ionicons name="person" size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={[styles.estudianteNombreLarge, { color: theme.text }]}>
                      {entregaSeleccionada.estudiante_nombre} {entregaSeleccionada.estudiante_apellido}
                    </Text>
                    <Text style={[styles.estudianteInfoText, { color: theme.textSecondary }]}>
                      CI: {entregaSeleccionada.estudiante_identificacion || entregaSeleccionada.id_estudiante} •
                      Entregado: {new Date(entregaSeleccionada.fecha_entrega).toLocaleDateString('es-ES')}
                    </Text>
                  </View>
                </View>

                <View style={[styles.archivoCard, {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border
                }]}>
                  <Text style={[styles.archivoLabel, { color: theme.textSecondary }]}>
                    Archivo entregado:
                  </Text>
                  <View style={styles.archivoInfo}>
                    <Ionicons name="document-text" size={16} color={theme.textSecondary} />
                    <Text style={[styles.archivoNombre, { color: theme.text }]}>
                      {entregaSeleccionada.archivo_nombre}
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Nota (0 - {nota_maxima})
                  </Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    keyboardType="decimal-pad"
                    value={notaInput}
                    onChangeText={(value) => {
                      const num = parseFloat(value);
                      if (value === '' || (!isNaN(num) && num >= 0 && num <= nota_maxima)) {
                        setNotaInput(value);
                      }
                    }}
                    placeholder="0.0"
                    placeholderTextColor={theme.textMuted}
                  />

                  {notaInput && parseFloat(notaInput) >= 0 && (
                    <View style={[styles.ponderacionCard, {
                      backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }]}>
                      <View style={styles.ponderacionHeader}>
                        <Ionicons name="bar-chart" size={14} color="#3b82f6" />
                        <Text style={styles.ponderacionLabel}>APORTE PONDERADO</Text>
                      </View>
                      <Text style={[styles.ponderacionFormula, { color: theme.text }]}>
                        {parseFloat(notaInput)}/{nota_maxima} × {ponderacion}pts = {' '}
                        <Text style={styles.ponderacionResult}>
                          {((parseFloat(notaInput) / nota_maxima) * ponderacion).toFixed(2)} puntos
                        </Text>
                      </Text>
                      <Text style={[styles.ponderacionDesc, { color: theme.textSecondary }]}>
                        Este es el aporte de esta tarea al promedio del módulo
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    Comentario (opcional)
                  </Text>
                  <TextInput
                    style={[styles.textArea, {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    multiline
                    numberOfLines={4}
                    value={comentarioInput}
                    onChangeText={setComentarioInput}
                    placeholder="Escribe un comentario sobre la entrega..."
                    placeholderTextColor={theme.textMuted}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              <View style={[styles.calificarFooter, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.calificarButton, styles.calificarButtonSecondary, {
                    borderColor: theme.border
                  }]}
                  onPress={cerrarModalCalificar}
                  disabled={calificando}
                >
                  <Text style={[styles.calificarButtonText, { color: theme.text }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.calificarButton, styles.calificarButtonPrimary, {
                    backgroundColor: calificando ? 'rgba(59, 130, 246, 0.6)' : '#3b82f6',
                    opacity: calificando ? 0.7 : 1
                  }]}
                  onPress={handleCalificar}
                  disabled={calificando}
                >
                  {calificando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trophy" size={16} color="#fff" />
                      <Text style={[styles.calificarButtonText, { color: '#fff' }]}>
                        {entregaSeleccionada.calificacion !== undefined && entregaSeleccionada.calificacion !== null
                          ? 'Actualizar'
                          : 'Calificar'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    padding: 4,
  },
  statsContainer: {
    margin: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  entregasList: {
    paddingHorizontal: 16,
    maxHeight: '50%',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  entregaCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  entregaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteInfo: {
    flex: 1,
  },
  estudianteNombre: {
    fontSize: 14,
    fontWeight: '600',
  },
  estudianteCI: {
    fontSize: 12,
    marginTop: 2,
  },
  entregaDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeCalificada: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  badgeTextCalificada: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  badgePendiente: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  badgeTextPendiente: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  calificacionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  calificacionText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  sinCalificar: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  calificarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 3000,
    elevation: 10,
  },
  calificarContent: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 12,
    maxHeight: '90%',
    elevation: 10,
    zIndex: 9999,
  },
  calificarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  calificarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  calificarBody: {
    padding: 16,
    maxHeight: '70%',
  },
  estudianteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteNombreLarge: {
    fontSize: 16,
    fontWeight: '600',
  },
  estudianteInfoText: {
    fontSize: 14,
    marginTop: 2,
  },
  archivoCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  archivoLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  archivoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archivoNombre: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  textArea: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 96,
  },
  ponderacionCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  ponderacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ponderacionLabel: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  ponderacionFormula: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  ponderacionResult: {
    color: '#3b82f6',
  },
  ponderacionDesc: {
    fontSize: 12,
  },
  calificarFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  calificarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
  },
  calificarButtonSecondary: {
    borderWidth: 1,
  },
  calificarButtonPrimary: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  calificarButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Estilos del modal de previsualización
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 2000,
  },
  previewContent: {
    width: '100%',
    maxWidth: 512,
    borderRadius: 12,
    maxHeight: '90%',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  previewFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewFileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewFileDate: {
    fontSize: 12,
    marginTop: 2,
  },
  previewContainer: {
    maxHeight: '65%',
  },
  previewContentContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  previewWebView: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  previewNoSupport: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  previewNoSupportText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    borderTopWidth: 1,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
  },
  previewButtonSecondary: {
    borderWidth: 1,
  },
  previewButtonPrimary: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
