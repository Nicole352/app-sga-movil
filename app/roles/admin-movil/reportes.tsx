import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Alert,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Pagination from './components/Pagination';
import CompactPicker from './components/CompactPicker';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

// Tipos
interface Curso {
    id_curso: number;
    codigo_curso: string;
    nombre: string;
    horario: string;
    fecha_inicio: string;
    fecha_fin: string;
    tipo_curso: string;
}

interface Periodo {
    inicio: string;
    fin: string;
    key: string;
}

interface ReporteHistorial {
    id_reporte: number;
    tipo_reporte: string;
    formato: string;
    fecha_generacion: string;
    parametros: any;
    nombre_archivo: string;
}

type TipoReporte = 'estudiantes' | 'cursos' | 'financiero';
type VistaActual = 'generar' | 'historial';

export default function AdminReportesScreen() {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Vista actual
    const [vistaActual, setVistaActual] = useState<VistaActual>('generar');

    // Tipo de reporte
    const [tipoReporte, setTipoReporte] = useState<TipoReporte>('estudiantes');
    const [showHelperMessage, setShowHelperMessage] = useState(true);

    // Períodos
    const [periodosDisponibles, setPeriodosDisponibles] = useState<Periodo[]>([]);
    const [periodoSeleccionado, setPeriodoSeleccionado] = useState('todos');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    // Cursos para filtros
    const [cursosDisponibles, setCursosDisponibles] = useState<Curso[]>([]);

    // Filtros Estudiantes
    const [filtroEstadoEstudiante, setFiltroEstadoEstudiante] = useState('todos');
    const [filtroCursoEstudiante, setFiltroCursoEstudiante] = useState('');
    const [filtroHorarioEstudiante, setFiltroHorarioEstudiante] = useState('todos');

    // Filtros Cursos
    const [filtroEstadoCurso, setFiltroEstadoCurso] = useState('todos');
    const [filtroOcupacionCurso, setFiltroOcupacionCurso] = useState('todos');
    const [filtroHorarioCurso, setFiltroHorarioCurso] = useState('todos');

    // Filtros Financiero
    const [filtroCursoFinanciero, setFiltroCursoFinanciero] = useState('');
    const [filtroEstadoCursoFinanciero, setFiltroEstadoCursoFinanciero] = useState('todos');
    const [filtroEstadoPago, setFiltroEstadoPago] = useState('todos');
    const [filtroMetodoPago, setFiltroMetodoPago] = useState('todos');
    const [filtroHorarioFinanciero, setFiltroHorarioFinanciero] = useState('todos');

    // Datos del reporte
    const [datosReporte, setDatosReporte] = useState<any[]>([]);
    const [estadisticas, setEstadisticas] = useState<any>(null);

    // Historial
    const [historialReportes, setHistorialReportes] = useState<ReporteHistorial[]>([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [filtroTipoHistorial, setFiltroTipoHistorial] = useState('todos');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Descarga
    const [descargando, setDescargando] = useState(false);

    // Búsqueda y ordenamiento
    const [busquedaRapida, setBusquedaRapida] = useState('');
    const [ordenamiento, setOrdenamiento] = useState<'nombre' | 'fecha' | 'monto'>('nombre');
    const [ordenAscendente, setOrdenAscendente] = useState(true);

    const theme = darkMode ? {
        bg: '#0a0a0a',
        cardBg: '#141414',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        border: '#27272a',
        primary: '#ef4444',
        inputBg: '#18181b',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
    } : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        text: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: '#e2e8f0',
        primary: '#ef4444',
        inputBg: '#ffffff',
        success: '#059669',
        warning: '#d97706',
        danger: '#ef4444',
    };

    useFocusEffect(
        useCallback(() => {
            setCurrentPage(1); // Reset pagination when screen gains focus
            loadInitialData();
        }, [])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        getDarkMode().then(setDarkMode);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    // Cargar datos iniciales
    const loadInitialData = async () => {
        await cargarCursosParaFiltro();
        await cargarPeriodosDisponibles();
    };

    // Cargar cursos para filtros
    const cargarCursosParaFiltro = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/reportes/cursos-filtro`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCursosDisponibles(data.data);
                }
            }
        } catch (error) {
            console.error('Error cargando cursos:', error);
        }
    };

    // Cargar períodos disponibles
    const cargarPeriodosDisponibles = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/reportes/cursos-filtro`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.length > 0) {
                    const periodosUnicos = new Set<string>();
                    data.data.forEach((curso: Curso) => {
                        if (curso.fecha_inicio && curso.fecha_fin) {
                            const inicio = curso.fecha_inicio.split('T')[0];
                            const fin = curso.fecha_fin.split('T')[0];
                            periodosUnicos.add(`${inicio}|${fin}`);
                        }
                    });

                    const periodosArray: Periodo[] = Array.from(periodosUnicos)
                        .map((periodo) => {
                            const [inicio, fin] = periodo.split('|');
                            return { inicio, fin, key: periodo };
                        })
                        .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

                    setPeriodosDisponibles(periodosArray);
                }
            }
        } catch (error) {
            console.error('Error cargando períodos:', error);
        }
    };

    // Actualizar fechas cuando cambia el período
    useEffect(() => {
        if (periodoSeleccionado === 'todos') {
            fetchRangoDinamico();
        } else if (periodoSeleccionado !== '') {
            const [inicio, fin] = periodoSeleccionado.split('|');
            setFechaInicio(inicio);
            setFechaFin(fin);
        }
    }, [periodoSeleccionado]);

    const fetchRangoDinamico = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/reportes/rango-fechas`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setFechaInicio(data.data.fechaInicio);
                    setFechaFin(data.data.fechaFin);
                }
            }
        } catch (error) {
            console.error('Error obteniendo rango dinámico:', error);
        }
    };

    // Generar reporte
    const generarReporte = async () => {
        if (!fechaInicio || !fechaFin) {
            Alert.alert('Error', 'Por favor espera a que se carguen los períodos');
            return;
        }

        setLoading(true);
        setCurrentPage(1);

        try {
            let url = '';
            let params = new URLSearchParams({
                fechaInicio,
                fechaFin
            });

            switch (tipoReporte) {
                case 'estudiantes':
                    url = `${API_URL}/reportes/estudiantes`;
                    if (filtroEstadoEstudiante !== 'todos') params.append('estado', filtroEstadoEstudiante);
                    if (filtroCursoEstudiante) params.append('idCurso', filtroCursoEstudiante);
                    if (filtroHorarioEstudiante !== 'todos') params.append('horario', filtroHorarioEstudiante);
                    break;
                case 'cursos':
                    url = `${API_URL}/reportes/cursos`;
                    if (filtroEstadoCurso !== 'todos') params.append('estado', filtroEstadoCurso);
                    if (filtroOcupacionCurso !== 'todos') params.append('ocupacion', filtroOcupacionCurso);
                    if (filtroHorarioCurso !== 'todos') params.append('horario', filtroHorarioCurso);
                    break;
                case 'financiero':
                    url = `${API_URL}/reportes/financiero`;
                    if (filtroCursoFinanciero) params.append('idCurso', filtroCursoFinanciero);
                    if (filtroEstadoCursoFinanciero !== 'todos') params.append('estadoCurso', filtroEstadoCursoFinanciero);
                    if (filtroEstadoPago !== 'todos') params.append('estadoPago', filtroEstadoPago);
                    if (filtroMetodoPago !== 'todos') params.append('metodoPago', filtroMetodoPago);
                    if (filtroHorarioFinanciero !== 'todos') params.append('horario', filtroHorarioFinanciero);
                    break;
            }

            const token = await getToken();
            const response = await fetch(`${url}?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success) {
                let datosProcessados = data.data.datos;

                // Para estudiantes, agrupar por estudiante (evitar duplicados)
                if (tipoReporte === 'estudiantes' && Array.isArray(datosProcessados)) {
                    const estudiantesMap = new Map();

                    datosProcessados.forEach((item: any) => {
                        const key = item.id_usuario;
                        if (!estudiantesMap.has(key)) {
                            // Primera vez que vemos este estudiante
                            estudiantesMap.set(key, {
                                ...item,
                                cursos: [{
                                    id_curso: item.id_curso,
                                    nombre_curso: item.nombre_curso,
                                    codigo_curso: item.codigo_curso,
                                    horario_curso: item.horario_curso,
                                    tipo_curso: item.tipo_curso,
                                    estado_academico: item.estado_academico,
                                    nota_final: item.nota_final
                                }]
                            });
                        } else {
                            // Ya existe, agregar curso al array
                            const estudiante = estudiantesMap.get(key);
                            estudiante.cursos.push({
                                id_curso: item.id_curso,
                                nombre_curso: item.nombre_curso,
                                codigo_curso: item.codigo_curso,
                                horario_curso: item.horario_curso,
                                tipo_curso: item.tipo_curso,
                                estado_academico: item.estado_academico,
                                nota_final: item.nota_final
                            });
                        }
                    });

                    datosProcessados = Array.from(estudiantesMap.values());
                }

                // Para financiero, agrupar por estudiante y curso
                if (tipoReporte === 'financiero' && Array.isArray(datosProcessados)) {
                    const financieroMap = new Map();

                    datosProcessados.forEach((item: any) => {
                        const key = item.cedula_estudiante; // Agrupar solo por estudiante
                        if (!financieroMap.has(key)) {
                            financieroMap.set(key, {
                                cedula_estudiante: item.cedula_estudiante,
                                nombre_estudiante: item.nombre_estudiante,
                                apellido_estudiante: item.apellido_estudiante,
                                email_estudiante: item.email_estudiante,
                                cursos: [{
                                    id_curso: item.id_curso,
                                    nombre_curso: item.nombre_curso,
                                    codigo_curso: item.codigo_curso,
                                    monto_total: parseFloat(item.monto || 0),
                                    monto_pagado: item.estado_pago === 'verificado' || item.estado_pago === 'pagado' ? parseFloat(item.monto || 0) : 0,
                                    monto_pendiente: item.estado_pago === 'pendiente' || item.estado_pago === 'vencido' ? parseFloat(item.monto || 0) : 0
                                }],
                                monto_total: parseFloat(item.monto || 0),
                                monto_pagado: item.estado_pago === 'verificado' || item.estado_pago === 'pagado' ? parseFloat(item.monto || 0) : 0,
                                monto_pendiente: item.estado_pago === 'pendiente' || item.estado_pago === 'vencido' ? parseFloat(item.monto || 0) : 0
                            });
                        } else {
                            const estudiante = financieroMap.get(key);

                            // Buscar si ya existe este curso
                            const cursoExistente = estudiante.cursos.find((c: any) => c.id_curso === item.id_curso);

                            if (cursoExistente) {
                                // Sumar al curso existente
                                cursoExistente.monto_total += parseFloat(item.monto || 0);
                                if (item.estado_pago === 'verificado' || item.estado_pago === 'pagado') {
                                    cursoExistente.monto_pagado += parseFloat(item.monto || 0);
                                }
                                if (item.estado_pago === 'pendiente' || item.estado_pago === 'vencido') {
                                    cursoExistente.monto_pendiente += parseFloat(item.monto || 0);
                                }
                            } else {
                                // Agregar nuevo curso
                                estudiante.cursos.push({
                                    id_curso: item.id_curso,
                                    nombre_curso: item.nombre_curso,
                                    codigo_curso: item.codigo_curso,
                                    monto_total: parseFloat(item.monto || 0),
                                    monto_pagado: item.estado_pago === 'verificado' || item.estado_pago === 'pagado' ? parseFloat(item.monto || 0) : 0,
                                    monto_pendiente: item.estado_pago === 'pendiente' || item.estado_pago === 'vencido' ? parseFloat(item.monto || 0) : 0
                                });
                            }

                            // Actualizar totales del estudiante
                            estudiante.monto_total += parseFloat(item.monto || 0);
                            if (item.estado_pago === 'verificado' || item.estado_pago === 'pagado') {
                                estudiante.monto_pagado += parseFloat(item.monto || 0);
                            }
                            if (item.estado_pago === 'pendiente' || item.estado_pago === 'vencido') {
                                estudiante.monto_pendiente += parseFloat(item.monto || 0);
                            }
                        }
                    });

                    datosProcessados = Array.from(financieroMap.values());
                }

                console.log(`[${tipoReporte}] Datos recibidos del backend:`, data.data.datos?.length || 0);
                console.log(`[${tipoReporte}] Datos procesados:`, datosProcessados?.length || 0);
                console.log(`[${tipoReporte}] Primer dato:`, datosProcessados?.[0]);

                setDatosReporte(datosProcessados || []);
                setEstadisticas(data.data.estadisticas);

                if (!datosProcessados || datosProcessados.length === 0) {
                    Alert.alert('Aviso', 'No se encontraron datos con los filtros seleccionados');
                }
            } else {
                Alert.alert('Error', data.message || 'Error al generar el reporte');
            }
        } catch (error: any) {
            console.error('Error generando reporte:', error);
            Alert.alert('Error', 'Error al generar el reporte');
        } finally {
            setLoading(false);
        }
    };

    // Descargar archivo
    const descargarArchivo = async (formato: 'pdf' | 'excel') => {
        if (!fechaInicio || !fechaFin) {
            Alert.alert('Error', 'Debes generar un reporte primero');
            return;
        }

        setDescargando(true);

        try {
            let url = '';
            let params = new URLSearchParams({ fechaInicio, fechaFin });

            switch (tipoReporte) {
                case 'estudiantes':
                    url = formato === 'excel'
                        ? `${API_URL}/reportes/estudiantes/excel-v2`
                        : `${API_URL}/reportes/estudiantes/pdf`;
                    if (filtroEstadoEstudiante !== 'todos') params.append('estado', filtroEstadoEstudiante);
                    if (filtroCursoEstudiante) params.append('idCurso', filtroCursoEstudiante);
                    if (filtroHorarioEstudiante !== 'todos') params.append('horario', filtroHorarioEstudiante);
                    break;
                case 'cursos':
                    url = formato === 'excel'
                        ? `${API_URL}/reportes/cursos/excel-v2`
                        : `${API_URL}/reportes/cursos/pdf`;
                    if (filtroEstadoCurso !== 'todos') params.append('estado', filtroEstadoCurso);
                    if (filtroOcupacionCurso !== 'todos') params.append('ocupacion', filtroOcupacionCurso);
                    if (filtroHorarioCurso !== 'todos') params.append('horario', filtroHorarioCurso);
                    break;
                case 'financiero':
                    url = formato === 'excel'
                        ? `${API_URL}/reportes/financiero/excel-v2`
                        : `${API_URL}/reportes/financiero/pdf`;
                    if (filtroCursoFinanciero) params.append('idCurso', filtroCursoFinanciero);
                    if (filtroEstadoCursoFinanciero !== 'todos') params.append('estadoCurso', filtroEstadoCursoFinanciero);
                    if (filtroEstadoPago !== 'todos') params.append('estadoPago', filtroEstadoPago);
                    if (filtroMetodoPago !== 'todos') params.append('metodoPago', filtroMetodoPago);
                    if (filtroHorarioFinanciero !== 'todos') params.append('horario', filtroHorarioFinanciero);
                    break;
            }

            const token = await getToken();
            const fullUrl = `${url}?${params}`;

            // Descargar archivo (PDF o Excel)
            const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
            const mimeType = formato === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const fileName = `reporte_${tipoReporte}_${Date.now()}.${extension}`;

            // @ts-ignore - documentDirectory y cacheDirectory existen en runtime
            const tempDir = Platform.OS === 'ios' ? FileSystem.documentDirectory : FileSystem.cacheDirectory;
            const fileUri = `${tempDir || ''}${fileName}`;

            // @ts-ignore - downloadAsync existe en runtime
            const downloadResult = await FileSystem.downloadAsync(
                fullUrl,
                fileUri,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (downloadResult.status === 200) {
                // Compartir el archivo descargado
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadResult.uri, {
                        mimeType: mimeType,
                        dialogTitle: `Guardar Reporte ${formato.toUpperCase()}`
                    });
                    Alert.alert('Éxito', `Reporte ${formato.toUpperCase()} listo para guardar`);
                } else {
                    Alert.alert('Descargado', `Archivo guardado en caché`);
                }
            } else {
                Alert.alert('Error', 'No se pudo descargar el archivo');
            }
        } catch (error) {
            console.error('Error descargando archivo:', error);
            Alert.alert('Error', 'Error al descargar el archivo');
        } finally {
            setDescargando(false);
        }
    };

    // Cargar historial
    const cargarHistorial = async () => {
        setLoadingHistorial(true);
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/reportes/historial?limite=50`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setHistorialReportes(data.data || []);
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
        } finally {
            setLoadingHistorial(false);
        }
    };

    useEffect(() => {
        if (vistaActual === 'historial') {
            cargarHistorial();
        }
    }, [vistaActual]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filtroTipoHistorial]);

    const onRefresh = async () => {
        setRefreshing(true);
        if (vistaActual === 'generar') {
            await loadInitialData();
        } else {
            await cargarHistorial();
        }
        setRefreshing(false);
    };

    // Formatear fecha
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/D';
        // Usar split para evitar problemas de zona horaria, igual que en la web
        const justDate = dateString.split('T')[0];
        const [year, month, day] = justDate.split('-');
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${day} ${months[parseInt(month) - 1]} ${year}`;
    };

    const formatMonto = (monto: number) => {
        return `$${Number(monto).toFixed(2)}`;
    };

    const getEmptyMessage = () => {
        const busqueda = (busquedaRapida).trim();

        if (vistaActual === 'historial') {
            if (filtroTipoHistorial !== 'todos') return "No se encontraron reportes de este tipo en el historial";
            return "No hay reportes generados aún";
        }

        if (busqueda) return `No se encontraron resultados para "${busqueda}"`;

        switch (tipoReporte) {
            case 'estudiantes':
                // Nota: filtroCursoEstudiante es string '' o 'numeric_id', evaluar si tiene valor
                if (filtroCursoEstudiante) return "No hay estudiantes registrados en este curso para el período seleccionado";
                if (filtroEstadoEstudiante !== 'todos') return `No hay estudiantes con estado "${filtroEstadoEstudiante}" en este período`;
                return "No hay estudiantes registrados en este período";
            case 'cursos':
                if (filtroEstadoCurso !== 'todos') return `No hay cursos con estado "${filtroEstadoCurso}" en este período`;
                return "No hay cursos registrados en este período";
            case 'financiero':
                if (filtroEstadoPago !== 'todos') return `No hay pagos con estado "${filtroEstadoPago}" en este período`;
                if (filtroMetodoPago !== 'todos') return `No hay pagos realizados con "${filtroMetodoPago}" en este período`;
                if (filtroCursoFinanciero) return "No hay registros financieros para este curso en el período seleccionado";
                return "No hay registros financieros en este período";
            default:
                return "No se encontraron datos";
        }
    };

    // Filtrar y ordenar datos
    const datosFiltradosYOrdenados = useMemo(() => {
        let datos = [...datosReporte];

        // Aplicar búsqueda rápida
        if (busquedaRapida.trim()) {
            const busqueda = busquedaRapida.toLowerCase();
            datos = datos.filter(item => {
                switch (tipoReporte) {
                    case 'estudiantes':
                        return (
                            item.nombre?.toLowerCase().includes(busqueda) ||
                            item.apellido?.toLowerCase().includes(busqueda) ||
                            item.cedula?.toLowerCase().includes(busqueda) ||
                            item.email?.toLowerCase().includes(busqueda)
                        );
                    case 'cursos':
                        return (
                            item.nombre_curso?.toLowerCase().includes(busqueda) ||
                            item.codigo_curso?.toLowerCase().includes(busqueda) ||
                            item.docente_nombres?.toLowerCase().includes(busqueda) ||
                            item.docente_apellidos?.toLowerCase().includes(busqueda)
                        );
                    case 'financiero':
                        return (
                            item.nombre_estudiante?.toLowerCase().includes(busqueda) ||
                            item.apellido_estudiante?.toLowerCase().includes(busqueda) ||
                            item.cedula_estudiante?.toLowerCase().includes(busqueda) ||
                            item.nombre_curso?.toLowerCase().includes(busqueda)
                        );
                    default:
                        return true;
                }
            });
        }

        // Aplicar ordenamiento
        datos.sort((a, b) => {
            let valorA: any, valorB: any;

            switch (ordenamiento) {
                case 'nombre':
                    if (tipoReporte === 'estudiantes') {
                        valorA = `${a.apellido} ${a.nombre}`;
                        valorB = `${b.apellido} ${b.nombre}`;
                    } else if (tipoReporte === 'cursos') {
                        valorA = a.nombre_curso;
                        valorB = b.nombre_curso;
                    } else {
                        valorA = `${a.apellido_estudiante} ${a.nombre_estudiante}`;
                        valorB = `${b.apellido_estudiante} ${b.nombre_estudiante}`;
                    }
                    break;
                case 'fecha':
                    valorA = new Date(a.fecha_inicio || a.fecha_inscripcion || 0).getTime();
                    valorB = new Date(b.fecha_inicio || b.fecha_inscripcion || 0).getTime();
                    break;
                case 'monto':
                    valorA = a.monto_total || a.total_estudiantes || 0;
                    valorB = b.monto_total || b.total_estudiantes || 0;
                    break;
            }

            if (valorA < valorB) return ordenAscendente ? -1 : 1;
            if (valorA > valorB) return ordenAscendente ? 1 : -1;
            return 0;
        });

        return datos;
    }, [datosReporte, busquedaRapida, ordenamiento, ordenAscendente, tipoReporte]);

    // Paginación
    const totalPages = Math.ceil(datosFiltradosYOrdenados.length / itemsPerPage);
    const paginatedData = datosFiltradosYOrdenados.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Historial filtrado y paginado
    const historialFiltrado = useMemo(() => {
        if (filtroTipoHistorial === 'todos') return historialReportes;
        return historialReportes.filter(r => r.tipo_reporte === filtroTipoHistorial);
    }, [historialReportes, filtroTipoHistorial]);

    const totalPagesHistorial = Math.ceil(historialFiltrado.length / itemsPerPage);
    const paginatedHistorial = historialFiltrado.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Renderizar filtros según tipo de reporte
    const renderFiltros = () => {
        switch (tipoReporte) {
            case 'estudiantes':
                return (
                    <>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Estado</Text>
                                <CompactPicker
                                    selectedValue={filtroEstadoEstudiante}
                                    onValueChange={setFiltroEstadoEstudiante}
                                    items={[
                                        { label: 'Todos', value: 'todos' },
                                        { label: 'Activo', value: 'activo' },
                                        { label: 'Inactivo', value: 'inactivo' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Curso</Text>
                                <CompactPicker
                                    selectedValue={filtroCursoEstudiante}
                                    onValueChange={setFiltroCursoEstudiante}
                                    items={[
                                        { label: 'Todos los cursos', value: '' },
                                        ...cursosDisponibles.map(c => ({ label: `${c.codigo_curso} - ${c.nombre}`, value: String(c.id_curso) }))
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Horario</Text>
                                <CompactPicker
                                    selectedValue={filtroHorarioEstudiante}
                                    onValueChange={setFiltroHorarioEstudiante}
                                    items={[
                                        { label: 'Todos', value: 'todos' },
                                        { label: 'Matutino', value: 'matutino' },
                                        { label: 'Vespertino', value: 'vespertino' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                    </>
                );
            case 'cursos':
                return (
                    <>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Estado</Text>
                                <CompactPicker
                                    selectedValue={filtroEstadoCurso}
                                    onValueChange={setFiltroEstadoCurso}
                                    items={[
                                        { label: 'Todos los estados', value: 'todos' },
                                        { label: 'Activos', value: 'activo' },
                                        { label: 'Finalizados', value: 'finalizado' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Ocupación</Text>
                                <CompactPicker
                                    selectedValue={filtroOcupacionCurso}
                                    onValueChange={setFiltroOcupacionCurso}
                                    items={[
                                        { label: 'Todas las ocupaciones', value: 'todos' },
                                        { label: 'Llenos (80-100%)', value: 'lleno' },
                                        { label: 'Media ocupación (40-79%)', value: 'medio' },
                                        { label: 'Baja ocupación (0-39%)', value: 'bajo' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Horario</Text>
                                <CompactPicker
                                    selectedValue={filtroHorarioCurso}
                                    onValueChange={setFiltroHorarioCurso}
                                    items={[
                                        { label: 'Todos los horarios', value: 'todos' },
                                        { label: 'Matutino', value: 'matutino' },
                                        { label: 'Vespertino', value: 'vespertino' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                    </>
                );
            case 'financiero':
                return (
                    <>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Curso</Text>
                                <CompactPicker
                                    selectedValue={filtroCursoFinanciero}
                                    onValueChange={setFiltroCursoFinanciero}
                                    items={[
                                        { label: 'Todos los cursos', value: '' },
                                        ...cursosDisponibles.map(c => ({ label: `${c.codigo_curso} - ${c.nombre}`, value: String(c.id_curso) }))
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Estado Pago</Text>
                                <CompactPicker
                                    selectedValue={filtroEstadoPago}
                                    onValueChange={setFiltroEstadoPago}
                                    items={[
                                        { label: 'Todos', value: 'todos' },
                                        { label: 'Pendiente', value: 'pendiente' },
                                        { label: 'Pagado', value: 'pagado' },
                                        { label: 'Verificado', value: 'verificado' },
                                        { label: 'Vencido', value: 'vencido' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                        <View style={styles.filterRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.filterLabel, { color: theme.textMuted }]}>Método Pago</Text>
                                <CompactPicker
                                    selectedValue={filtroMetodoPago}
                                    onValueChange={setFiltroMetodoPago}
                                    items={[
                                        { label: 'Todos', value: 'todos' },
                                        { label: 'Transferencia', value: 'transferencia' },
                                        { label: 'Efectivo', value: 'efectivo' }
                                    ]}
                                    theme={theme}
                                />
                            </View>
                        </View>
                    </>
                );
        }
    };

    // Renderizar estadísticas


    // Renderizar item de datos
    const renderDatoItem = ({ item }: { item: any }) => {
        switch (tipoReporte) {
            case 'estudiantes':
                return (
                    <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <View style={styles.dataHeader}>
                            <Text style={[styles.dataName, { color: theme.text }]}>
                                {item.apellido}, {item.nombre}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: item.estado_usuario === 'activo' ? theme.success + '20' : theme.textMuted + '20' }]}>
                                <Text style={[styles.statusText, { color: item.estado_usuario === 'activo' ? theme.success : theme.textMuted }]}>
                                    {item.estado_usuario}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="card" size={14} color={theme.textMuted} />
                            <Text style={[styles.dataText, { color: theme.textSecondary }]}>{item.cedula}</Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="mail" size={14} color={theme.textMuted} />
                            <Text style={[styles.dataText, { color: theme.textSecondary }]}>{item.email}</Text>
                        </View>
                        {/* Mostrar todos los cursos del estudiante */}
                        {item.cursos && item.cursos.length > 0 && (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                                <Text style={[styles.dataText, { color: theme.textMuted, fontSize: 11, marginBottom: 4 }]}>
                                    Cursos ({item.cursos.length}):
                                </Text>
                                {item.cursos.map((curso: any, idx: number) => (
                                    <View key={idx} style={[styles.dataRow, { marginBottom: 4 }]}>
                                        <Ionicons name="book" size={12} color={theme.primary} />
                                        <Text style={[styles.dataText, { color: theme.text, fontSize: 12 }]}>
                                            {curso.nombre_curso} ({curso.horario_curso?.toUpperCase()})
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            case 'cursos':
                return (
                    <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <View style={styles.dataHeader}>
                            <Text style={[styles.dataName, { color: theme.text }]}>{item.nombre_curso}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.statusText, { color: theme.primary }]}>{item.horario?.toUpperCase()}</Text>
                            </View>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="person" size={14} color={theme.textMuted} />
                            <Text style={[styles.dataText, { color: theme.textSecondary, fontSize: 13 }]}>
                                Docente: {item.docente_apellidos} {item.docente_nombres}
                            </Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="barcode" size={14} color={theme.textMuted} />
                            <Text style={[styles.dataText, { color: theme.textSecondary }]}>{item.codigo_curso}</Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="people" size={14} color={theme.success} />
                            <Text style={[styles.dataText, { color: theme.text }]}>
                                {item.total_estudiantes || 0} / {item.capacidad_maxima} estudiantes
                            </Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="trending-up" size={14} color={theme.warning} />
                            <Text style={[styles.dataText, { color: theme.text }]}>
                                Ocupación: {item.porcentaje_ocupacion || 0}%
                            </Text>
                        </View>
                    </View>
                );
            case 'financiero':
                return (
                    <View style={[styles.dataCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                        <View style={styles.dataHeader}>
                            <View>
                                <Text style={[styles.dataName, { color: theme.text }]}>
                                    {item.apellido_estudiante}, {item.nombre_estudiante}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <Ionicons name="card-outline" size={12} color={theme.textMuted} />
                                    <Text style={{ fontSize: 11, color: theme.textMuted }}>ID: {item.cedula_estudiante || item.cedula || item.identificacion}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Totales generales del estudiante */}
                        <View style={[styles.dataRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }]}>
                            <Ionicons name="cash" size={14} color={theme.success} />
                            <Text style={[styles.dataText, { color: theme.success, fontWeight: '700' }]}>
                                Total General: {formatMonto(item.monto_total || 0)}
                            </Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                            <Text style={[styles.dataText, { color: theme.textSecondary }]}>
                                Pagado: {formatMonto(item.monto_pagado || 0)}
                            </Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Ionicons name="time" size={14} color={theme.warning} />
                            <Text style={[styles.dataText, { color: theme.textSecondary }]}>
                                Pendiente: {formatMonto(item.monto_pendiente || 0)}
                            </Text>
                        </View>

                        {/* Desglose por curso */}
                        {item.cursos && item.cursos.length > 0 && (
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                                <Text style={[styles.dataText, { color: theme.textMuted, fontSize: 10, marginBottom: 4 }]}>
                                    Desglose por curso:
                                </Text>
                                {item.cursos.map((curso: any, idx: number) => (
                                    <View key={idx} style={{ marginBottom: 6, paddingLeft: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons name="book" size={11} color={theme.primary} />
                                            <Text style={[styles.dataText, { color: theme.primary, fontWeight: '600', fontSize: 11 }]}>
                                                {curso.codigo_curso ? `[${curso.codigo_curso}] ` : ''}{curso.nombre_curso}
                                            </Text>
                                        </View>
                                        <Text style={[styles.dataText, { color: theme.textSecondary, fontSize: 10, marginLeft: 15 }]}>
                                            Total: {formatMonto(curso.monto_total)} | Pagado: {formatMonto(curso.monto_pagado)} | Pendiente: {formatMonto(curso.monto_pendiente)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            default:
                return null;
        }
    };

    // Renderizar item de historial
    const renderHistorialItem = ({ item }: { item: ReporteHistorial }) => (
        <View style={[styles.historialCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.historialHeader}>
                <Ionicons
                    name={item.tipo_reporte === 'estudiantes' ? 'people' : item.tipo_reporte === 'cursos' ? 'book' : 'cash'}
                    size={24}
                    color={theme.primary}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.historialTipo, { color: theme.text }]}>
                        {item.tipo_reporte ? item.tipo_reporte.charAt(0).toUpperCase() + item.tipo_reporte.slice(1) : 'Reporte Desconocido'}
                    </Text>
                    <Text style={[styles.historialFecha, { color: theme.textMuted }]}>
                        {formatDate(item.fecha_generacion)}
                    </Text>
                </View>
                <View style={[styles.formatoBadge, { backgroundColor: item.formato === 'pdf' ? theme.warning + '20' : theme.success + '20' }]}>
                    <Ionicons
                        name={item.formato === 'pdf' ? 'document-text' : 'document'}
                        size={16}
                        color={item.formato === 'pdf' ? theme.warning : theme.success}
                    />
                    <Text style={[styles.formatoText, { color: item.formato === 'pdf' ? theme.warning : theme.success }]}>
                        {item.formato ? item.formato.toUpperCase() : 'PDF'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header Clean Nike Effect */}
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Reportes</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Genera y descarga reportes del sistema</Text>

                {/* Tabs */}
                <View style={[styles.tabsContainer, { backgroundColor: theme.bg, padding: 4, borderRadius: 12 }]}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            vistaActual === 'generar' && { backgroundColor: theme.cardBg, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                        ]}
                        onPress={() => {
                            setVistaActual('generar');
                            setCurrentPage(1);
                        }}
                    >
                        <Ionicons name="document-text" size={18} color={vistaActual === 'generar' ? theme.primary : theme.textMuted} />
                        <Text style={[styles.tabText, { color: vistaActual === 'generar' ? theme.primary : theme.textMuted }]}>Generar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            vistaActual === 'historial' && { backgroundColor: theme.cardBg, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                        ]}
                        onPress={() => {
                            setVistaActual('historial');
                            setCurrentPage(1);
                        }}
                    >
                        <Ionicons name="time" size={18} color={vistaActual === 'historial' ? theme.primary : theme.textMuted} />
                        <Text style={[styles.tabText, { color: vistaActual === 'historial' ? theme.primary : theme.textMuted }]}>Historial</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {vistaActual === 'generar' ? (
                    <View style={styles.content}>
                        {/* Selector de Tipo de Reporte */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tipo de Reporte</Text>
                            <View style={styles.tipoReporteContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.tipoReporteBtn,
                                        { backgroundColor: tipoReporte === 'estudiantes' ? theme.primary + '20' : theme.cardBg, borderColor: tipoReporte === 'estudiantes' ? theme.primary : theme.border }
                                    ]}
                                    onPress={() => {
                                        setTipoReporte('estudiantes');
                                        setDatosReporte([]);
                                        setEstadisticas(null);
                                        setBusquedaRapida('');
                                        setCurrentPage(1);
                                        setShowHelperMessage(true);
                                    }}
                                >
                                    <Ionicons name="people" size={20} color={tipoReporte === 'estudiantes' ? theme.primary : theme.textMuted} />
                                    <Text style={[styles.tipoReporteText, { color: tipoReporte === 'estudiantes' ? theme.primary : theme.text }]}>Estudiantes</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.tipoReporteBtn,
                                        { backgroundColor: tipoReporte === 'cursos' ? theme.primary + '20' : theme.cardBg, borderColor: tipoReporte === 'cursos' ? theme.primary : theme.border }
                                    ]}
                                    onPress={() => {
                                        setTipoReporte('cursos');
                                        setDatosReporte([]);
                                        setEstadisticas(null);
                                        setBusquedaRapida('');
                                        setCurrentPage(1);
                                        setShowHelperMessage(true);
                                    }}
                                >
                                    <Ionicons name="book" size={20} color={tipoReporte === 'cursos' ? theme.primary : theme.textMuted} />
                                    <Text style={[styles.tipoReporteText, { color: tipoReporte === 'cursos' ? theme.primary : theme.text }]}>Cursos</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.tipoReporteBtn,
                                        { backgroundColor: tipoReporte === 'financiero' ? theme.primary + '20' : theme.cardBg, borderColor: tipoReporte === 'financiero' ? theme.primary : theme.border }
                                    ]}
                                    onPress={() => {
                                        setTipoReporte('financiero');
                                        setDatosReporte([]);
                                        setEstadisticas(null);
                                        setBusquedaRapida('');
                                        setCurrentPage(1);
                                        setShowHelperMessage(true);
                                    }}
                                >
                                    <Ionicons name="cash" size={20} color={tipoReporte === 'financiero' ? theme.primary : theme.textMuted} />
                                    <Text style={[styles.tipoReporteText, { color: tipoReporte === 'financiero' ? theme.primary : theme.text }]}>Financiero</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Mensaje de ayuda cuando no hay datos */}
                        {datosReporte.length === 0 && showHelperMessage && (
                            <View style={[styles.helperMessageContainer, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                                <Ionicons name="information-circle" size={20} color={theme.primary} />
                                <Text style={[styles.helperMessageText, { color: theme.text }]}>
                                    Configura los filtros y presiona el botón <Text style={{ color: theme.primary, fontWeight: '700' }}>Generar Reporte</Text> de abajo para visualizar el reporte de {tipoReporte === 'estudiantes' ? 'Estudiantes' : tipoReporte === 'cursos' ? 'Cursos' : 'Financiero'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowHelperMessage(false)} style={{ padding: 4 }}>
                                    <Ionicons name="close" size={20} color={theme.textMuted} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Selector de Período */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Período</Text>
                            <CompactPicker
                                selectedValue={periodoSeleccionado}
                                onValueChange={setPeriodoSeleccionado}
                                items={[
                                    { label: 'Todos los períodos', value: 'todos' },
                                    ...periodosDisponibles.map(p => ({
                                        label: `${formatDate(p.inicio)} - ${formatDate(p.fin)}`,
                                        value: p.key
                                    }))
                                ]}
                                placeholder="Seleccionar período"
                                theme={theme}
                            />
                        </View>

                        {/* Filtros Dinámicos */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Filtros</Text>
                            {renderFiltros()}
                        </View>

                        {/* Botón Generar */}
                        <TouchableOpacity
                            style={[styles.generateBtn, { backgroundColor: theme.primary }]}
                            onPress={generarReporte}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="bar-chart" size={20} color="#fff" />
                                    <Text style={styles.generateBtnText}>Generar Reporte</Text>
                                </>
                            )}
                        </TouchableOpacity>


                        {/* Lista de Datos */}
                        {datosReporte.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                    Datos ({datosFiltradosYOrdenados.length} de {datosReporte.length} registros)
                                </Text>

                                {/* Búsqueda Rápida */}
                                <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                                    <Ionicons name="search" size={20} color={theme.textMuted} />
                                    <TextInput
                                        style={[styles.searchInput, { color: theme.text }]}
                                        placeholder={
                                            tipoReporte === 'estudiantes' ? "Buscar por nombre, identificación o email..." :
                                                tipoReporte === 'cursos' ? "Buscar por nombre, código o docente..." :
                                                    "Buscar por nombre, identificación o curso..."
                                        }
                                        placeholderTextColor={theme.textMuted}
                                        value={busquedaRapida}
                                        onChangeText={setBusquedaRapida}
                                    />
                                    {busquedaRapida.length > 0 && (
                                        <TouchableOpacity onPress={() => setBusquedaRapida('')}>
                                            <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Ordenamiento */}
                                <View style={styles.sortContainer}>
                                    <Text style={[styles.sortLabel, { color: theme.textMuted }]}>Ordenar por:</Text>
                                    <View style={styles.sortButtons}>
                                        <TouchableOpacity
                                            style={[
                                                styles.sortBtn,
                                                { backgroundColor: ordenamiento === 'nombre' ? theme.primary + '20' : theme.cardBg, borderColor: ordenamiento === 'nombre' ? theme.primary : theme.border }
                                            ]}
                                            onPress={() => {
                                                if (ordenamiento === 'nombre') {
                                                    setOrdenAscendente(!ordenAscendente);
                                                } else {
                                                    setOrdenamiento('nombre');
                                                    setOrdenAscendente(true);
                                                }
                                            }}
                                        >
                                            <Ionicons name={tipoReporte === 'cursos' ? 'book' : 'person'} size={16} color={ordenamiento === 'nombre' ? theme.primary : theme.textMuted} />
                                            <Text style={[styles.sortBtnText, { color: ordenamiento === 'nombre' ? theme.primary : theme.text }]}>
                                                {tipoReporte === 'cursos' ? 'Nombre del curso' : 'Apellidos'}
                                            </Text>
                                            {ordenamiento === 'nombre' && (
                                                <Ionicons name={ordenAscendente ? 'arrow-up' : 'arrow-down'} size={14} color={theme.primary} />
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.sortBtn,
                                                { backgroundColor: ordenamiento === 'fecha' ? theme.primary + '20' : theme.cardBg, borderColor: ordenamiento === 'fecha' ? theme.primary : theme.border }
                                            ]}
                                            onPress={() => {
                                                if (ordenamiento === 'fecha') {
                                                    setOrdenAscendente(!ordenAscendente);
                                                } else {
                                                    setOrdenamiento('fecha');
                                                    setOrdenAscendente(false);
                                                }
                                            }}
                                        >
                                            <Ionicons name="calendar" size={16} color={ordenamiento === 'fecha' ? theme.primary : theme.textMuted} />
                                            <Text style={[styles.sortBtnText, { color: ordenamiento === 'fecha' ? theme.primary : theme.text }]}>Fecha</Text>
                                            {ordenamiento === 'fecha' && (
                                                <Ionicons name={ordenAscendente ? 'arrow-up' : 'arrow-down'} size={14} color={theme.primary} />
                                            )}
                                        </TouchableOpacity>

                                        {tipoReporte === 'financiero' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.sortBtn,
                                                    { backgroundColor: ordenamiento === 'monto' ? theme.primary + '20' : theme.cardBg, borderColor: ordenamiento === 'monto' ? theme.primary : theme.border }
                                                ]}
                                                onPress={() => {
                                                    if (ordenamiento === 'monto') {
                                                        setOrdenAscendente(!ordenAscendente);
                                                    } else {
                                                        setOrdenamiento('monto');
                                                        setOrdenAscendente(false);
                                                    }
                                                }}
                                            >
                                                <Ionicons name="cash" size={16} color={ordenamiento === 'monto' ? theme.primary : theme.textMuted} />
                                                <Text style={[styles.sortBtnText, { color: ordenamiento === 'monto' ? theme.primary : theme.text }]}>Monto</Text>
                                                {ordenamiento === 'monto' && (
                                                    <Ionicons name={ordenAscendente ? 'arrow-up' : 'arrow-down'} size={14} color={theme.primary} />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <FlatList
                                    data={paginatedData}
                                    renderItem={renderDatoItem}
                                    keyExtractor={(item, index) => index.toString()}
                                    scrollEnabled={false}
                                    ListFooterComponent={
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            totalItems={paginatedData.length}
                                            onPageChange={setCurrentPage}
                                            theme={theme}
                                            itemLabel="registros"
                                        />
                                    }
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="search-outline" size={48} color={theme.textMuted} />
                                            <Text style={[styles.emptyText, { color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 20 }]}>
                                                {getEmptyMessage()}
                                            </Text>
                                        </View>
                                    }
                                />
                            </View>
                        )}

                        {/* Botones de Descarga */}
                        {datosReporte.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Descargar</Text>
                                <View style={styles.downloadBtns}>
                                    <TouchableOpacity
                                        style={[styles.downloadBtn, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}
                                        onPress={() => descargarArchivo('pdf')}
                                        disabled={descargando}
                                    >
                                        <Ionicons name="document-text" size={20} color={theme.warning} />
                                        <Text style={[styles.downloadBtnText, { color: theme.warning }]}>PDF</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.downloadBtn, { backgroundColor: theme.success + '20', borderColor: theme.success }]}
                                        onPress={() => descargarArchivo('excel')}
                                        disabled={descargando}
                                    >
                                        <Ionicons name="document" size={20} color={theme.success} />
                                        <Text style={[styles.downloadBtnText, { color: theme.success }]}>Excel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.content}>
                        {/* Filtro de Historial */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Filtrar por Tipo</Text>
                            <CompactPicker
                                selectedValue={filtroTipoHistorial}
                                onValueChange={setFiltroTipoHistorial}
                                items={[
                                    { label: 'Todos', value: 'todos' },
                                    { label: 'Estudiantes', value: 'estudiantes' },
                                    { label: 'Cursos', value: 'cursos' },
                                    { label: 'Financiero', value: 'financiero' }
                                ]}
                                theme={theme}
                            />
                        </View>

                        {/* Lista de Historial */}
                        {loadingHistorial ? (
                            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                        ) : paginatedHistorial.length > 0 ? (
                            <FlatList
                                data={paginatedHistorial}
                                renderItem={renderHistorialItem}
                                keyExtractor={(item) => item.id_reporte.toString()}
                                scrollEnabled={false}
                                ListFooterComponent={
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={totalPagesHistorial}
                                        totalItems={paginatedHistorial.length}
                                        onPageChange={setCurrentPage}
                                        theme={theme}
                                        itemLabel="reportes"
                                    />
                                }
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="folder-open-outline" size={48} color={theme.textMuted} />
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    No hay reportes en el historial
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: '#fff', marginTop: 12 }}>Generando reporte...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        marginBottom: 4,
        paddingTop: 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3
    },
    headerTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, marginBottom: 16 },
    tabsContainer: { flexDirection: 'row', gap: 0 },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
    },
    tabActive: {}, // Handled inline now
    tabText: { fontWeight: '600', fontSize: 13 },
    content: { paddingTop: 5, paddingHorizontal: 20, paddingBottom: 20 },
    section: { marginBottom: 3 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    tipoReporteContainer: { flexDirection: 'row', gap: 8 },
    tipoReporteBtn: {
        flex: 1,
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 2,
    },
    tipoReporteText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
    filterRow: { marginBottom: 8 },
    filterLabel: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    metricsScroll: { marginBottom: 10 },
    metricCard: {
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        marginRight: 10,
        minWidth: 100,
    },
    metricValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
    metricLabel: { fontSize: 10, marginTop: 3 },
    dataCard: {
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 10,
    },
    dataHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dataName: { fontSize: 14, fontWeight: '700', flex: 1 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusText: { fontSize: 10, fontWeight: '700' },
    dataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    dataText: { fontSize: 12 },
    downloadBtns: { flexDirection: 'row', gap: 12 },
    downloadBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
    },
    downloadBtnText: { fontWeight: '700', fontSize: 14 },
    historialCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
    },
    historialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historialTipo: { fontSize: 16, fontWeight: '700' },
    historialFecha: { fontSize: 12, marginTop: 2 },
    formatoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    formatoText: { fontSize: 11, fontWeight: '700' },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: { fontSize: 14, marginTop: 12 },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 0,
    },
    sortContainer: {
        marginBottom: 16,
    },
    sortLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    sortBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    helperMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginTop: 10,
    },
    helperMessageText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
});
