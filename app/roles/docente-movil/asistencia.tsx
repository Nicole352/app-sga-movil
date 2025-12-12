import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { getToken, getDarkMode, getUserData } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Curso {
  id_curso: number;
  codigo_curso: string;
  nombre_curso: string;
  horario: string;
  tipo_curso_nombre: string;
  total_estudiantes: number;
  modalidad?: string;
}

interface Estudiante {
  id_estudiante: number;
  cedula: string;
  nombre: string;
  apellido: string;
  email: string;
}

interface RegistroAsistencia {
  id_estudiante: number;
  estado: 'presente' | 'ausente' | 'tardanza' | 'justificado';
  observaciones?: string;
  documento_justificacion?: any;
  documento_nombre_original?: string;
  documento_preview?: string;
  tiene_documento?: boolean;
  documento_size_kb?: number;
}

export default function AsistenciaScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState<number | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [asistencias, setAsistencias] = useState<Map<number, RegistroAsistencia>>(new Map());
  const [idDocente, setIdDocente] = useState<number | null>(null);
  const [asistenciaGuardada, setAsistenciaGuardada] = useState(false);
  const [showJustificacionModal, setShowJustificacionModal] = useState(false);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<number | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [documentoJustificacion, setDocumentoJustificacion] = useState<any>(null);
  const [documentoPreview, setDocumentoPreview] = useState<string | null>(null);
  const [documentoNombre, setDocumentoNombre] = useState<string>('');
  const [exportando, setExportando] = useState(false);
  const [showCursoPicker, setShowCursoPicker] = useState(false);

  useEffect(() => {
    loadData();

    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchDocenteId();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (cursoSeleccionado) {
      await loadEstudiantes(cursoSeleccionado);
      await loadAsistenciaExistente(cursoSeleccionado, fechaSeleccionada);
    }
    setRefreshing(false);
  };

  const fetchDocenteId = async () => {
    try {
      console.log('🔍 Obteniendo ID del docente...');
      const token = await getToken();
      if (!token) {
        console.log('❌ No hay token');
        return;
      }

      const userData = await getUserData();
      if (!userData) {
        console.log('❌ No hay userData');
        return;
      }
      console.log('👤 UserData ID:', userData.id_usuario);

      const docenteRes = await fetch(`${API_URL}/docentes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (docenteRes.ok) {
        const docentes = await docenteRes.json();
        console.log('📋 Total docentes:', docentes.length);
        const docente = docentes.find((d: any) => d.id_usuario === userData.id_usuario);
        if (docente) {
          console.log('✅ Docente encontrado, ID:', docente.id_docente);
          setIdDocente(docente.id_docente);
          loadCursos(docente.id_docente);
        } else {
          console.log('❌ Docente no encontrado con id_usuario:', userData.id_usuario);
          console.log('📋 Docentes disponibles:', docentes.map((d: any) => ({ id_usuario: d.id_usuario, id_docente: d.id_docente })));
        }
      } else {
        console.log('❌ Error en respuesta de docentes:', docenteRes.status);
      }
    } catch (error) {
      console.error('Error obteniendo datos del docente:', error);
    }
  };

  const loadCursos = async (docenteId: number) => {
    try {
      const token = await getToken();
      console.log('Cargando cursos para docente:', docenteId);
      const response = await fetch(`${API_URL}/asistencias/cursos-docente/${docenteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Cursos obtenidos:', data.cursos?.length || 0);
        console.log('Datos de cursos:', JSON.stringify(data.cursos, null, 2));
        setCursos(data.cursos || []);
      } else {
        console.error('Error en respuesta de cursos:', response.status);
      }
    } catch (error) {
      console.error('Error cargando cursos:', error);
    }
  };

  const loadEstudiantes = async (cursoId: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/asistencias/estudiantes/${cursoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const estudiantesData = data.estudiantes || [];

        estudiantesData.sort((a: Estudiante, b: Estudiante) => {
          const apellidoA = (a.apellido || '').trim().toUpperCase();
          const apellidoB = (b.apellido || '').trim().toUpperCase();
          return apellidoA.localeCompare(apellidoB, 'es');
        });

        setEstudiantes(estudiantesData);
        setAsistencias(new Map());
        setAsistenciaGuardada(false);
      }
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAsistenciaExistente = async (cursoId: number, fecha: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_URL}/asistencias/curso/${cursoId}/fecha/${fecha}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const nuevasAsistencias = new Map<number, RegistroAsistencia>();

        data.asistencias.forEach((a: any) => {
          nuevasAsistencias.set(a.id_estudiante, {
            id_estudiante: a.id_estudiante,
            estado: a.estado,
            observaciones: a.observaciones || '',
          });
        });

        setAsistencias(nuevasAsistencias);

        if (nuevasAsistencias.size > 0) {
          setAsistenciaGuardada(true);
        }
      }
    } catch (error) {
      console.error('Error cargando asistencia existente:', error);
    }
  };

  const handleCursoChange = async (cursoId: number) => {
    console.log('Curso seleccionado:', cursoId);
    setCursoSeleccionado(cursoId);
    setAsistencias(new Map());
    setAsistenciaGuardada(false);
    await loadEstudiantes(cursoId);
    if (fechaSeleccionada) {
      await loadAsistenciaExistente(cursoId, fechaSeleccionada);
    }
  };

  const handleFechaChange = (fecha: string) => {
    setFechaSeleccionada(fecha);
    setAsistenciaGuardada(false);
    if (cursoSeleccionado) {
      loadAsistenciaExistente(cursoSeleccionado, fecha);
    }
  };

  const marcarAsistencia = (
    idEstudiante: number,
    estado: 'presente' | 'ausente' | 'tardanza' | 'justificado'
  ) => {
    if (estado === 'justificado') {
      setEstudianteSeleccionado(idEstudiante);
      const registroActual = asistencias.get(idEstudiante);
      setObservaciones(registroActual?.observaciones || '');
      setDocumentoNombre(registroActual?.documento_nombre_original || '');
      setDocumentoPreview(registroActual?.documento_preview || null);
      setDocumentoJustificacion(registroActual?.documento_justificacion || null);
      setShowJustificacionModal(true);
      return;
    }

    const nuevasAsistencias = new Map(asistencias);
    nuevasAsistencias.set(idEstudiante, {
      id_estudiante: idEstudiante,
      estado,
      observaciones: asistencias.get(idEstudiante)?.observaciones || ''
    });
    setAsistencias(nuevasAsistencias);
    setAsistenciaGuardada(false);
  };

  const handlePhotoOptions = () => {
    Alert.alert(
      'Adjuntar Documento',
      'Selecciona una opción',
      [
        { text: 'Tomar Foto', onPress: () => takePhoto() },
        { text: 'Elegir de Galería', onPress: () => pickImage() },
        { text: 'Seleccionar Documento', onPress: () => pickDocument() },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = uri.split('/').pop() || 'foto.jpg';
      setDocumentoJustificacion({ uri, type: 'image/jpeg', name: fileName });
      setDocumentoPreview(uri);
      setDocumentoNombre(fileName);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = uri.split('/').pop() || 'imagen.jpg';
      setDocumentoJustificacion({ uri, type: 'image/jpeg', name: fileName });
      setDocumentoPreview(uri);
      setDocumentoNombre(fileName);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setDocumentoJustificacion({ uri: file.uri, type: file.mimeType, name: file.name });
        setDocumentoNombre(file.name);
        if (file.mimeType?.startsWith('image/')) {
          setDocumentoPreview(file.uri);
        } else {
          setDocumentoPreview(null);
        }
      }
    } catch (error) {
      console.error('Error seleccionando documento:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  };

  const exportarExcel = async () => {
    if (!cursoSeleccionado || estudiantes.length === 0) {
      Alert.alert('Error', 'Selecciona un curso con estudiantes primero');
      return;
    }

    try {
      setExportando(true);

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // HOJA 1: Detalle de Asistencia
      const wsData: any[][] = [];

      // Título
      const cursoActual = cursos.find(c => c.id_curso === cursoSeleccionado);
      wsData.push([`REGISTRO DE ASISTENCIA - ${cursoActual?.nombre_curso || 'Curso'}`]);
      wsData.push([`Fecha: ${new Date(fechaSeleccionada).toLocaleDateString('es-ES')}`]);
      wsData.push([]);

      // Encabezados
      wsData.push(['#', 'Cédula', 'Apellido', 'Nombre', 'Estado', 'Observaciones']);

      // Datos de estudiantes
      estudiantes.forEach((estudiante, index) => {
        const registro = asistencias.get(estudiante.id_estudiante);
        const estado = registro?.estado || 'ausente';
        const estadoTexto = estado === 'presente' ? 'Presente'
          : estado === 'ausente' ? 'Ausente'
            : estado === 'tardanza' ? 'Tardanza'
              : 'Justificado';
        const observaciones = registro?.observaciones || '-';

        wsData.push([
          index + 1,
          estudiante.cedula,
          estudiante.apellido,
          estudiante.nombre,
          estadoTexto,
          observaciones
        ]);
      });

      // Agregar estadísticas
      wsData.push([]);
      wsData.push(['RESUMEN']);
      const totalEstudiantes = estudiantes.length;
      const presentes = Array.from(asistencias.values()).filter(a => a.estado === 'presente').length;
      const ausentes = Array.from(asistencias.values()).filter(a => a.estado === 'ausente').length;
      const tardanzas = Array.from(asistencias.values()).filter(a => a.estado === 'tardanza').length;
      const justificados = Array.from(asistencias.values()).filter(a => a.estado === 'justificado').length;
      const porcentajeAsistencia = totalEstudiantes > 0 ? ((presentes / totalEstudiantes) * 100).toFixed(1) : '0';

      wsData.push(['Total Estudiantes', totalEstudiantes]);
      wsData.push(['Presentes', presentes]);
      wsData.push(['Ausentes', ausentes]);
      wsData.push(['Tardanzas', tardanzas]);
      wsData.push(['Justificados', justificados]);
      wsData.push(['% Asistencia', `${porcentajeAsistencia}%`]);

      // Crear hoja
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 12 }, // Cédula
        { wch: 20 }, // Apellido
        { wch: 20 }, // Nombre
        { wch: 12 }, // Estado
        { wch: 40 }, // Observaciones
      ];

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

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

      const nombreCurso = limpiarNombre(cursoActual?.nombre_curso || 'Curso');
      const nombreArchivo = `Asistencia_${nombreCurso}_${fechaSeleccionada}.xlsx`;

      // Guardar archivo
      const file = new FileSystem.File(FileSystem.Paths.cache, nombreArchivo);
      await file.create();
      await file.write(wbout, { encoding: 'base64' });

      // Compartir archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar Asistencia a Excel',
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

  const guardarJustificacion = () => {
    if (estudianteSeleccionado !== null) {
      const nuevasAsistencias = new Map(asistencias);
      nuevasAsistencias.set(estudianteSeleccionado, {
        id_estudiante: estudianteSeleccionado,
        estado: 'justificado',
        observaciones: observaciones.trim(),
        documento_justificacion: documentoJustificacion,
        documento_nombre_original: documentoNombre,
        documento_preview: documentoPreview || undefined,
        tiene_documento: documentoJustificacion ? true : false,
        documento_size_kb: documentoJustificacion ? Math.round((documentoJustificacion.size || 0) / 1024) : 0
      });
      setAsistencias(nuevasAsistencias);
      setAsistenciaGuardada(false);
      setShowJustificacionModal(false);
      setEstudianteSeleccionado(null);
      setObservaciones('');
      setDocumentoJustificacion(null);
      setDocumentoPreview(null);
      setDocumentoNombre('');
    }
  };

  const eliminarDocumento = () => {
    setDocumentoJustificacion(null);
    setDocumentoPreview(null);
    setDocumentoNombre('');
  };

  const guardarAsistencia = async () => {
    if (!cursoSeleccionado || !idDocente) {
      Alert.alert('Error', 'Selecciona un curso primero');
      return;
    }

    if (asistencias.size === 0) {
      Alert.alert('Error', 'Marca al menos un estudiante');
      return;
    }

    const estudiantesSinEstado = estudiantes.filter(est => !asistencias.has(est.id_estudiante));
    if (estudiantesSinEstado.length > 0) {
      const nombres = estudiantesSinEstado.map(e => `${e.nombre} ${e.apellido}`).join(', ');
      Alert.alert('Error', `Aún falta registrar la asistencia de: ${nombres}`);
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();

      const datosAsistencia = {
        id_curso: cursoSeleccionado,
        id_docente: idDocente,
        fecha: fechaSeleccionada,
        asistencias: Array.from(asistencias.values()).map(registro => ({
          id_estudiante: registro.id_estudiante,
          estado: registro.estado,
          observaciones: registro.observaciones || null,
          tiene_documento: false,
          documento_nombre_original: null,
          documento_size_kb: null
        }))
      };

      const response = await fetch(`${API_URL}/asistencias`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: JSON.stringify(datosAsistencia) })
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Asistencia guardada correctamente');
        setAsistenciaGuardada(true);
        await loadAsistenciaExistente(cursoSeleccionado, fechaSeleccionada);
      } else {
        Alert.alert('Error', 'No se pudo guardar la asistencia');
      }
    } catch (error) {
      console.error('Error guardando asistencia:', error);
      Alert.alert('Error', 'Error al guardar la asistencia');
    } finally {
      setSaving(false);
    }
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.6)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
    accent: '#3b82f6',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
    purple: '#8b5cf6',
  };

  const contadores = {
    presentes: Array.from(asistencias.values()).filter(a => a.estado === 'presente').length,
    ausentes: Array.from(asistencias.values()).filter(a => a.estado === 'ausente').length,
    tardanzas: Array.from(asistencias.values()).filter(a => a.estado === 'tardanza').length,
    justificados: Array.from(asistencias.values()).filter(a => a.estado === 'justificado').length,
  };

  const getEstadoColor = (estado: 'presente' | 'ausente' | 'tardanza' | 'justificado') => {
    switch (estado) {
      case 'presente': return theme.green;
      case 'ausente': return theme.red;
      case 'tardanza': return theme.orange;
      case 'justificado': return theme.purple;
      default: return theme.textMuted;
    }
  };

  const getEstadoIcon = (estado: 'presente' | 'ausente' | 'tardanza' | 'justificado') => {
    switch (estado) {
      case 'presente': return 'checkmark-circle';
      case 'ausente': return 'close-circle';
      case 'tardanza': return 'time';
      case 'justificado': return 'document-text';
      default: return 'help-circle';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tomar Asistencia</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Registra la asistencia de tus estudiantes
        </Text>
      </View>

      {/* Selectores */}
      <View style={[styles.selectorsContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.pickerContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}
          onPress={() => setShowCursoPicker(true)}
        >
          <Text style={[styles.pickerText, { color: cursoSeleccionado ? theme.text : theme.textMuted }]}>
            {cursoSeleccionado
              ? cursos.find(c => c.id_curso === cursoSeleccionado)?.nombre_curso || '-- Selecciona un curso --'
              : '-- Selecciona un curso --'
            }
          </Text>
          <Ionicons name="chevron-down" size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={[styles.dateContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Ionicons name="calendar" size={20} color={theme.accent} />
          <Text style={[styles.dateText, { color: theme.text }]}>
            {new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>
      </View>

      {/* Contadores */}
      {cursoSeleccionado && estudiantes.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.green + '20', borderColor: theme.green + '40' }]}>
            <Ionicons name="checkmark-circle" size={16} color={theme.green} />
            <Text style={[styles.statValue, { color: theme.green }]}>{contadores.presentes}</Text>
            <Text style={[styles.statLabel, { color: theme.green }]}>Presentes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.red + '20', borderColor: theme.red + '40' }]}>
            <Ionicons name="close-circle" size={16} color={theme.red} />
            <Text style={[styles.statValue, { color: theme.red }]}>{contadores.ausentes}</Text>
            <Text style={[styles.statLabel, { color: theme.red }]}>Ausentes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.orange + '20', borderColor: theme.orange + '40' }]}>
            <Ionicons name="time" size={16} color={theme.orange} />
            <Text style={[styles.statValue, { color: theme.orange }]}>{contadores.tardanzas}</Text>
            <Text style={[styles.statLabel, { color: theme.orange }]}>Tardanzas</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.purple + '20', borderColor: theme.purple + '40' }]}>
            <Ionicons name="document-text" size={16} color={theme.purple} />
            <Text style={[styles.statValue, { color: theme.purple }]}>{contadores.justificados}</Text>
            <Text style={[styles.statLabel, { color: theme.purple }]}>Justificados</Text>
          </View>
        </View>
      )}

      {/* Lista de Estudiantes */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {!cursoSeleccionado ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="clipboard-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Selecciona un curso</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Elige un curso para comenzar a tomar asistencia
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando estudiantes...</Text>
          </View>
        ) : estudiantes.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay estudiantes</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Este curso no tiene estudiantes matriculados
            </Text>
          </View>
        ) : (
          <View style={styles.estudiantesList}>
            {/* Encabezado de tabla */}
            <View style={[styles.tablaHeader, { backgroundColor: theme.accent + '10', borderBottomColor: theme.accent }]}>
              <Text style={[styles.tablaHeaderText, { color: theme.accent, flex: 2 }]}>ESTUDIANTE</Text>
              <View style={styles.tablaHeaderEstados}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.green} />
                </View>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="close-circle" size={18} color={theme.red} />
                </View>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="time" size={18} color={theme.orange} />
                </View>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="document-text" size={18} color={theme.purple} />
                </View>
              </View>
            </View>

            {/* Filas de estudiantes */}
            {estudiantes.map((estudiante) => {
              const registro = asistencias.get(estudiante.id_estudiante);
              const estado = registro?.estado;

              return (
                <View key={estudiante.id_estudiante} style={[styles.tablaFila, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={styles.estudianteInfoCompacto}>
                    <View style={[styles.estudianteAvatarPequeno, { backgroundColor: estado ? getEstadoColor(estado) : theme.textMuted }]}>
                      <Text style={styles.estudianteAvatarTextPequeno}>
                        {estudiante.nombre.charAt(0)}{estudiante.apellido.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.estudianteNombreCompacto, { color: theme.text }]}>
                        {estudiante.apellido}, {estudiante.nombre}
                      </Text>
                      <Text style={[styles.estudianteCedulaCompacto, { color: theme.textMuted }]}>
                        {estudiante.cedula}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.botonesAsistenciaCompacto}>
                    <TouchableOpacity
                      style={[
                        styles.botonEstadoCompacto,
                        estado === 'presente' && { backgroundColor: theme.green },
                        { borderColor: theme.green }
                      ]}
                      onPress={() => marcarAsistencia(estudiante.id_estudiante, 'presente')}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={estado === 'presente' ? '#fff' : theme.green}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.botonEstadoCompacto,
                        estado === 'ausente' && { backgroundColor: theme.red },
                        { borderColor: theme.red }
                      ]}
                      onPress={() => marcarAsistencia(estudiante.id_estudiante, 'ausente')}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={estado === 'ausente' ? '#fff' : theme.red}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.botonEstadoCompacto,
                        estado === 'tardanza' && { backgroundColor: theme.orange },
                        { borderColor: theme.orange }
                      ]}
                      onPress={() => marcarAsistencia(estudiante.id_estudiante, 'tardanza')}
                    >
                      <Ionicons
                        name="time"
                        size={18}
                        color={estado === 'tardanza' ? '#fff' : theme.orange}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.botonEstadoCompacto,
                        estado === 'justificado' && { backgroundColor: theme.purple },
                        { borderColor: theme.purple }
                      ]}
                      onPress={() => marcarAsistencia(estudiante.id_estudiante, 'justificado')}
                    >
                      <Ionicons
                        name="document-text"
                        size={18}
                        color={estado === 'justificado' ? '#fff' : theme.purple}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Botones Guardar y Exportar */}
      {cursoSeleccionado && estudiantes.length > 0 && (
        <View style={[styles.footer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.exportButton,
              { backgroundColor: exportando ? 'rgba(34, 197, 94, 0.6)' : '#22c55e' },
              exportando && styles.guardarButtonDisabled
            ]}
            onPress={exportarExcel}
            disabled={exportando}
          >
            {exportando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.guardarButton,
              { backgroundColor: asistenciaGuardada ? theme.green : theme.accent },
              saving && styles.guardarButtonDisabled
            ]}
            onPress={guardarAsistencia}
            disabled={saving || asistenciaGuardada}
          >
            <Ionicons
              name={asistenciaGuardada ? 'checkmark-circle' : 'save'}
              size={20}
              color="#fff"
            />
            <Text style={styles.guardarButtonText}>
              {saving ? 'Guardando...' : asistenciaGuardada ? 'Asistencia Guardada' : 'Guardar Asistencia'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de Selección de Curso */}
      <Modal
        visible={showCursoPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCursoPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.cursoPickerModal, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Seleccionar Curso</Text>
              <TouchableOpacity onPress={() => setShowCursoPicker(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Encabezados de tabla */}
            <View style={[styles.tableHeader, { backgroundColor: theme.accent + '15', borderBottomColor: theme.border }]}>
              <Text style={[styles.tableHeaderText, { color: theme.accent, flex: 2 }]}>Curso</Text>
              <Text style={[styles.tableHeaderText, { color: theme.accent, flex: 1 }]}>Código</Text>
              <Text style={[styles.tableHeaderText, { color: theme.accent, flex: 1, textAlign: 'center' }]}>Est.</Text>
            </View>

            <ScrollView style={styles.cursosList}>
              {cursos.map(curso => (
                <TouchableOpacity
                  key={curso.id_curso}
                  style={[
                    styles.cursoItem,
                    { borderBottomColor: theme.border },
                    cursoSeleccionado === curso.id_curso && { backgroundColor: theme.accent + '10' }
                  ]}
                  onPress={() => {
                    handleCursoChange(curso.id_curso);
                    setShowCursoPicker(false);
                  }}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.cursoNombre, { color: theme.text }]} numberOfLines={1}>
                      {curso.nombre_curso}
                    </Text>
                    <Text style={[styles.cursoHorario, { color: theme.textMuted }]}>
                      {curso.horario}
                    </Text>
                  </View>
                  <Text style={[styles.cursoCodigo, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {curso.codigo_curso}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={[styles.estudiantesBadge, { backgroundColor: theme.green + '20', borderColor: theme.green + '40' }]}>
                      <Text style={[styles.estudiantesText, { color: theme.green }]}>
                        {curso.total_estudiantes}
                      </Text>
                    </View>
                  </View>
                  {cursoSeleccionado === curso.id_curso && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.accent} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Justificación */}
      <Modal
        visible={showJustificacionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJustificacionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Justificar Ausencia</Text>
              <TouchableOpacity onPress={() => setShowJustificacionModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Observaciones */}
              <Text style={[styles.modalLabel, { color: theme.text }]}>Motivo de la justificación</Text>
              <TextInput
                style={[styles.modalTextArea, {
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderColor: theme.border,
                  color: theme.text
                }]}
                placeholder="Escribe el motivo de la justificación..."
                placeholderTextColor={theme.textMuted}
                value={observaciones}
                onChangeText={setObservaciones}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Documento */}
              <Text style={[styles.modalLabel, { color: theme.text, marginTop: 16 }]}>
                Documento de justificación (opcional)
              </Text>

              {documentoNombre ? (
                <View style={[styles.documentoContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
                  {documentoPreview ? (
                    <Image source={{ uri: documentoPreview }} style={styles.documentoPreview} />
                  ) : (
                    <View style={[styles.documentoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="document" size={40} color={theme.accent} />
                    </View>
                  )}
                  <View style={styles.documentoInfo}>
                    <Text style={[styles.documentoNombre, { color: theme.text }]} numberOfLines={2}>
                      {documentoNombre}
                    </Text>
                    <TouchableOpacity
                      style={[styles.eliminarButton, { backgroundColor: theme.red + '20' }]}
                      onPress={eliminarDocumento}
                    >
                      <Ionicons name="trash" size={16} color={theme.red} />
                      <Text style={[styles.eliminarButtonText, { color: theme.red }]}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.adjuntarButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}
                  onPress={handlePhotoOptions}
                >
                  <Ionicons name="attach" size={20} color={theme.accent} />
                  <Text style={[styles.adjuntarButtonText, { color: theme.accent }]}>
                    Adjuntar Documento
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButtonSecondary, { borderColor: theme.border }]}
                onPress={() => setShowJustificacionModal(false)}
              >
                <Text style={[styles.modalButtonSecondaryText, { color: theme.textSecondary }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, { backgroundColor: theme.purple }]}
                onPress={guardarJustificacion}
              >
                <Text style={styles.modalButtonPrimaryText}>Guardar</Text>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
  },
  selectorsContainer: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 7.5,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  estudiantesList: {
    padding: 16,
  },
  tablaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    marginBottom: 4,
  },
  tablaHeaderText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  tablaHeaderEstados: {
    flexDirection: 'row',
    gap: 4,
  },
  tablaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
    marginBottom: 2,
  },
  estudianteCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  estudianteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  estudianteInfoCompacto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 2,
  },
  estudianteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteAvatarPequeno: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  estudianteAvatarTextPequeno: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  estudianteTexto: {
    flex: 1,
  },
  estudianteNombre: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  estudianteNombreCompacto: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  estudianteCedula: {
    fontSize: 11,
  },
  estudianteCedulaCompacto: {
    fontSize: 10,
  },
  botonesAsistencia: {
    flexDirection: 'row',
    gap: 8,
  },
  botonesAsistenciaCompacto: {
    flexDirection: 'row',
    gap: 4,
  },
  botonEstado: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonEstadoCompacto: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  exportButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  guardarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  guardarButtonDisabled: {
    opacity: 0.6,
  },
  guardarButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  documentoContainer: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  documentoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  documentoIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentoInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  documentoNombre: {
    fontSize: 13,
    fontWeight: '600',
  },
  eliminarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  eliminarButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  adjuntarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  adjuntarButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  cursoPickerModal: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cursosList: {
    maxHeight: 400,
  },
  cursoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  cursoItemContent: {
    flex: 1,
  },
  cursoNombre: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  cursoHorario: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  cursoCodigo: {
    fontSize: 12,
    fontWeight: '500',
  },
  cursoDetalle: {
    fontSize: 12,
  },
  estudiantesBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 32,
    alignItems: 'center',
  },
  estudiantesText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
