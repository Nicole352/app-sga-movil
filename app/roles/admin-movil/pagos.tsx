import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    RefreshControl,
    Alert,
    ScrollView,
    Image,
    Dimensions,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Pago {
    id_pago: number;
    numero_cuota: number;
    monto: number;
    fecha_vencimiento: string;
    fecha_pago: string | null;
    metodo_pago: string;
    numero_comprobante: string | null;
    banco_comprobante: string | null;
    fecha_transferencia: string | null;
    comprobante_pago_url?: string | null;
    estado: 'pendiente' | 'pagado' | 'verificado' | 'vencido';
    observaciones: string | null;
    verificado_por: number | null;
    fecha_verificacion: string | null;
    verificado_por_nombre?: string;
    verificado_por_apellido?: string;
    estudiante_nombre: string;
    estudiante_apellido: string;
    estudiante_cedula: string;
    curso_nombre: string;
    codigo_matricula: string;
    id_curso: number;
    modalidad_pago?: 'mensual' | 'clases';
    numero_clases?: number;
    precio_por_clase?: number;
    curso_horario?: string;
    recibido_por?: string;
}

interface EstudianteAgrupado {
    estudiante_cedula: string;
    estudiante_nombre: string;
    estudiante_apellido: string;
    cursos: {
        id_curso: number;
        curso_nombre: string;
        codigo_matricula: string;
        pagos: Pago[];
    }[];
}

export default function AdminPagosScreen() {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Datos
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [estudiantes, setEstudiantes] = useState<EstudianteAgrupado[]>([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modales
    const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showComprobanteModal, setShowComprobanteModal] = useState(false);
    const [comprobanteUrl, setComprobanteUrl] = useState('');
    // const [showRechazoModal, setShowRechazoModal] = useState(false); // Removed
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [selectedCursoTab, setSelectedCursoTab] = useState<'todos' | number>('todos');

    // Visor de Archivos
    const [archivoPreview, setArchivoPreview] = useState<{
        url: string;
        titulo: string;
        tipo: 'image' | 'pdf' | 'otro';
    } | null>(null);

    // Selección de curso y cuota por estudiante
    const [selectedCurso, setSelectedCurso] = useState<{ [cedula: string]: number }>({});
    const [selectedCuota, setSelectedCuota] = useState<{ [key: string]: number }>({});

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

    const [viewMode, setViewMode] = useState<'detail' | 'reject' | 'verify'>('detail');

    // Estado para Verificación Masiva (Smart Verification)
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [pagoAVerificar, setPagoAVerificar] = useState<Pago | null>(null);
    const [cuotasAVerificar, setCuotasAVerificar] = useState<number[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filterEstado])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        getDarkMode().then(setDarkMode);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            if (!token) return;

            const params = new URLSearchParams();
            if (filterEstado !== 'todos') params.set('estado', filterEstado);
            params.set('limit', '999999');

            const response = await fetch(`${API_URL}/admin/pagos?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setPagos(data);
                const agrupados = agruparPorEstudiante(data);
                setEstudiantes(agrupados);

                // Inicializar selectores
                const initCursos: { [key: string]: number } = {};
                const initCuotas: { [key: string]: number } = {};
                agrupados.forEach(est => {
                    if (est.cursos.length > 0) {
                        initCursos[est.estudiante_cedula] = est.cursos[0].id_curso;
                        const key = `${est.estudiante_cedula}-${est.cursos[0].id_curso}`;
                        if (est.cursos[0].pagos.length > 0) {
                            // Priorizar pagos "pagado" (pendientes de verificar)
                            const pagoPendiente = est.cursos[0].pagos.find(p => p.estado === 'pagado');
                            initCuotas[key] = pagoPendiente ? pagoPendiente.id_pago : est.cursos[0].pagos[0].id_pago;
                        }
                    }
                });
                setSelectedCurso(initCursos);
                setSelectedCuota(initCuotas);
            }
        } catch (error) {
            console.error('Error loading pagos:', error);
            Alert.alert('Error', 'No se pudieron cargar los pagos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const agruparPorEstudiante = (pagosData: Pago[]): EstudianteAgrupado[] => {
        const grupos: { [key: string]: EstudianteAgrupado } = {};

        pagosData.forEach(pago => {
            const cedula = pago.estudiante_cedula;
            if (!grupos[cedula]) {
                grupos[cedula] = {
                    estudiante_cedula: cedula,
                    estudiante_nombre: pago.estudiante_nombre,
                    estudiante_apellido: pago.estudiante_apellido,
                    cursos: []
                };
            }

            let curso = grupos[cedula].cursos.find(c => c.id_curso === pago.id_curso);
            if (!curso) {
                curso = {
                    id_curso: pago.id_curso,
                    curso_nombre: pago.curso_nombre,
                    codigo_matricula: pago.codigo_matricula,
                    pagos: []
                };
                grupos[cedula].cursos.push(curso);
            }
            curso.pagos.push(pago);
        });

        // Ordenar pagos por número de cuota
        Object.values(grupos).forEach(est => {
            est.cursos.forEach(curso => {
                curso.pagos.sort((a, b) => a.numero_cuota - b.numero_cuota);
            });
        });

        return Object.values(grupos);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
    };

    const formatMonto = (monto: number) => {
        return `$${Number(monto).toFixed(2)}`;
    };

    const formatDate = (d?: string | null) => {
        if (!d) return 'N/D';
        return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'pendiente': return theme.textMuted;
            case 'pagado': return theme.warning;
            case 'verificado': return theme.success;
            case 'vencido': return theme.danger;
            default: return theme.textMuted;
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'pendiente': return 'time-outline';
            case 'pagado': return 'hourglass-outline';
            case 'verificado': return 'checkmark-circle';
            case 'vencido': return 'alert-circle';
            default: return 'help-circle-outline';
        }
    };

    const pagosPorVerificar = useMemo(() => {
        return pagos.filter(p => p.estado === 'pagado').length;
    }, [pagos]);

    const handleVerComprobante = async (pago: Pago) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/admin/pagos/${pago.id_pago}/comprobante`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.comprobante_pago_url) {
                    const url = data.comprobante_pago_url;
                    const titulo = `Comprobante: ${pago.numero_comprobante || 'S/N'}`;
                    const extension = url.toLowerCase().split('.').pop()?.split('?')[0];
                    let tipo: 'image' | 'pdf' | 'otro' = 'otro';

                    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
                        tipo = 'image';
                    } else if (extension === 'pdf') {
                        tipo = 'pdf';
                    }

                    setSelectedPago(pago); // Asegurar que el pago esté seleccionado para las acciones del visor
                    setShowDetailModal(false); // Cerrar el detalle para que el visor sea visible
                    setArchivoPreview({ url, titulo, tipo });
                } else {
                    Alert.alert('Error', 'Comprobante no disponible');
                }
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar el comprobante');
        }
    };

    const handleVerificarPago = async (pago: Pago) => {
        console.log("Iniciando verificación para:", pago.id_pago);
        setArchivoPreview(null); // Cerrar el visor si está abierto
        setPagoAVerificar(pago);
        setCuotasAVerificar([pago.id_pago]); // Por defecto seleccionar la actual
        setViewMode('verify');
        setShowDetailModal(true); // Asegurar que el modal principal esté visible
    };

    const confirmarVerificacionMasiva = async () => {
        if (!pagoAVerificar || cuotasAVerificar.length === 0) return;

        try {
            setProcesando(true);
            const token = await getToken();

            // Obtener ID del usuario actual
            const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = await meRes.json();

            // Verificar cada cuota seleccionada
            for (const id_pago of cuotasAVerificar) {
                const response = await fetch(`${API_URL}/admin/pagos/${id_pago}/verificar`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ verificado_por: userData.id_usuario })
                });

                if (!response.ok) {
                    console.error(`Error verificando pago ${id_pago}`);
                    // Opcional: mostrar alerta si falla uno específico, o continuar
                }
            }

            Alert.alert('Éxito', `${cuotasAVerificar.length} cuota(s) verificada(s) correctamente`);
            Alert.alert('Éxito', `${cuotasAVerificar.length} cuota(s) verificada(s) correctamente`);
            setShowDetailModal(false); // Cerrar todo el modal
            setPagoAVerificar(null);
            setCuotasAVerificar([]);
            await loadData(); // Recargar datos

        } catch (error) {
            Alert.alert('Error', 'Ocurrió un error al procesar la verificación');
            console.error(error);
        } finally {
            setProcesando(false);
        }
    };

    const handleRechazarPago = (pago: Pago) => {
        if (pago) setSelectedPago(pago); // Asegurar que selectedPago esté seteado
        setMotivoRechazo('');
        setViewMode('reject');
    };

    const confirmarRechazo = async () => {
        if (!motivoRechazo.trim()) {
            Alert.alert('Atención', 'Por favor ingrese el motivo del rechazo');
            return;
        }

        if (!selectedPago) return;

        try {
            setProcesando(true);
            const token = await getToken();

            const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = await meRes.json();

            const response = await fetch(`${API_URL}/admin/pagos/${selectedPago.id_pago}/rechazar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    observaciones: motivoRechazo,
                    verificado_por: userData.id_usuario
                })
            });

            if (response.ok) {
                Alert.alert('Éxito', 'Pago rechazado correctamente');
                setShowDetailModal(false);
                await loadData();
            } else {
                Alert.alert('Error', 'No se pudo rechazar el pago');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de red');
        } finally {
            setProcesando(false);
        }
    };

    const getCursoSeleccionado = (estudiante: EstudianteAgrupado) => {
        const idCurso = selectedCurso[estudiante.estudiante_cedula];
        return estudiante.cursos.find(c => c.id_curso === idCurso) || estudiante.cursos[0];
    };

    const getPagoSeleccionado = (estudiante: EstudianteAgrupado, curso: EstudianteAgrupado['cursos'][number]): Pago | null => {
        const key = `${estudiante.estudiante_cedula}-${curso.id_curso}`;
        const idCuota = selectedCuota[key];
        return curso.pagos.find(p => p.id_pago === idCuota) || curso.pagos[0] || null;
    };

    const cursosDisponibles = useMemo(() => {
        const map = new Map<string, { id: number; nombre: string }>();
        estudiantes.forEach(est => {
            est.cursos.forEach(curso => {
                if (!map.has(curso.curso_nombre)) {
                    map.set(curso.curso_nombre, {
                        id: curso.id_curso,
                        nombre: curso.curso_nombre
                    });
                }
            });
        });
        return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [estudiantes]);

    const estudiantesFiltrados = useMemo(() => {
        let result = estudiantes;

        // Filtrar por búsqueda
        result = result.filter(est => {
            const matchSearch =
                est.estudiante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                est.estudiante_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
                est.estudiante_cedula.includes(searchTerm);
            return matchSearch;
        });

        // Filtrar por pestaña de curso
        if (selectedCursoTab !== 'todos') {
            const cursoSeleccionado = cursosDisponibles.find(c => c.id === selectedCursoTab);
            if (cursoSeleccionado) {
                result = result.filter(est =>
                    est.cursos.some(curso => curso.curso_nombre === cursoSeleccionado.nombre)
                );
            }
        }

        return result;
    }, [estudiantes, searchTerm, selectedCursoTab, cursosDisponibles]);

    // Paginación
    const totalPages = Math.ceil(estudiantesFiltrados.length / itemsPerPage);
    const paginatedEstudiantes = estudiantesFiltrados.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterEstado]);

    const renderEstudiante = ({ item }: { item: EstudianteAgrupado }) => {
        // Si hay una pestaña de curso seleccionada, usamos ese curso
        const cursoInfoSeleccionado = selectedCursoTab !== 'todos' ? cursosDisponibles.find(c => c.id === selectedCursoTab) : null;

        const curso = cursoInfoSeleccionado
            ? (item.cursos.find(c => c.curso_nombre === cursoInfoSeleccionado.nombre) || item.cursos[0])
            : getCursoSeleccionado(item);

        if (!curso) return null;

        const pago = getPagoSeleccionado(item, curso);
        if (!pago) return null;

        const estadoColor = getEstadoColor(pago.estado);
        const estadoIcon = getEstadoIcon(pago.estado);

        const showCourseSelector = selectedCursoTab === 'todos';

        return (
            <TouchableOpacity
                style={[styles.cardCompact, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => {
                    setSelectedPago(pago);
                    setViewMode('detail');
                    setShowDetailModal(true);
                }}
                activeOpacity={0.8}
            >
                {/* Header Estudiante Compacto */}
                <View style={styles.cardHeaderCompact}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.studentNameCompact, { color: theme.text }]}>
                            {item.estudiante_apellido}, {item.estudiante_nombre}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: theme.textMuted }}>ID: {item.estudiante_cedula}</Text>
                        </View>
                    </View>
                    <View style={[styles.estadoBadgeSmall, { backgroundColor: estadoColor + '15', borderColor: estadoColor + '40' }]}>
                        <Ionicons name={estadoIcon as any} size={11} color={estadoColor} />
                        <Text style={[styles.estadoTextSmall, { color: estadoColor }]}>{pago.estado.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Selectores en fila si es posible o muy compactos */}
                <View style={{ marginTop: 8 }}>
                    {showCourseSelector ? (
                        <View style={{ marginBottom: 4 }}>
                            <CompactPicker
                                selectedValue={String(selectedCurso[item.estudiante_cedula])}
                                onValueChange={(value) => {
                                    setSelectedCurso(prev => ({ ...prev, [item.estudiante_cedula]: Number(value) }));
                                }}
                                items={item.cursos.map(c => ({
                                    label: c.curso_nombre,
                                    value: String(c.id_curso)
                                }))}
                                theme={theme}
                            />
                        </View>
                    ) : (
                        <View style={{ marginBottom: 4, padding: 8, backgroundColor: theme.primary + '08', borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '15' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="book-outline" size={14} color={theme.primary} />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{curso.curso_nombre}</Text>
                                </View>
                                <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '600' }}>MAT: {curso.codigo_matricula}</Text>
                            </View>
                        </View>
                    )}

                    <CompactPicker
                        selectedValue={String(selectedCuota[`${item.estudiante_cedula}-${curso.id_curso}`])}
                        onValueChange={(value) => {
                            const key = `${item.estudiante_cedula}-${curso.id_curso}`;
                            setSelectedCuota(prev => ({ ...prev, [key]: Number(value) }));
                        }}
                        items={curso.pagos.map(p => ({
                            label: `Cuota ${p.numero_cuota} - ${formatMonto(p.monto)} - ${p.estado}`,
                            value: String(p.id_pago)
                        }))}
                        theme={theme}
                    />
                </View>

                {/* Footer Info & Actions */}
                <View style={[styles.cardFooterCompact, { borderTopColor: theme.border + '50' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.primary }}>
                            {formatMonto(pago.monto)}
                        </Text>
                        <Text style={{ fontSize: 10, color: theme.textMuted }}>Vence: {formatDate(pago.fecha_vencimiento)}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {pago.comprobante_pago_url && (
                            <TouchableOpacity
                                style={[styles.btnCircle, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                                onPress={() => handleVerComprobante(pago)}
                            >
                                <Ionicons name="receipt-outline" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.btnCircle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                            onPress={() => {
                                setSelectedPago(pago);
                                setViewMode('detail');
                                setShowDetailModal(true);
                            }}
                        >
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header Clean Nike Effect */}
            <View
                style={[
                    styles.summaryCard,
                    {
                        backgroundColor: theme.cardBg,
                        borderBottomColor: theme.border,
                        borderBottomWidth: 1,
                    }
                ]}
            >
                <Text style={[styles.headerTitle, { color: theme.text }]}>Gestión de Pagos</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Verifica y administra los pagos mensuales</Text>

                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1, marginTop: 10 }]}>
                    <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginLeft: 10 }} />
                    <TextInput
                        placeholder="Buscar estudiante..."
                        placeholderTextColor={theme.textMuted}
                        style={[styles.searchInput, { color: theme.text }]}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 8 }}>
                            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filtros Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                    style={{ marginTop: 10 }}
                >
                    {['todos', 'pendiente', 'pagado', 'verificado', 'vencido'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterButton,
                                {
                                    backgroundColor: filterEstado === f ? theme.primary : theme.inputBg,
                                    borderColor: filterEstado === f ? theme.primary : theme.border,
                                }
                            ]}
                            onPress={() => setFilterEstado(f)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                {
                                    color: filterEstado === f ? '#fff' : theme.text,
                                    fontWeight: filterEstado === f ? '700' : '600'
                                }
                            ]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Pestañas de Cursos (Estilo Web) */}
                {cursosDisponibles.length > 0 && (
                    <View style={{ marginTop: 15 }}>
                        <Text style={{ fontSize: 10, color: theme.textMuted, marginBottom: 6, fontWeight: '700' }}>CURSOS ACTIVOS:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                            {['todos', ...cursosDisponibles.map(c => c.id)].map((cursoId) => {
                                const isAll = cursoId === 'todos';
                                const cursoInfo = isAll ? { nombre: 'Todos' } : cursosDisponibles.find(c => c.id === cursoId);
                                const isActive = selectedCursoTab === cursoId;

                                return (
                                    <TouchableOpacity
                                        key={String(cursoId)}
                                        onPress={() => setSelectedCursoTab(cursoId as any)}
                                        style={[
                                            styles.courseTab,
                                            {
                                                backgroundColor: isActive ? theme.primary : theme.bg,
                                                borderColor: isActive ? theme.primary : theme.border,
                                                borderWidth: 1
                                            }
                                        ]}
                                    >
                                        <Ionicons
                                            name={isAll ? "apps-outline" : "book-outline"}
                                            size={14}
                                            color={isActive ? '#fff' : theme.textSecondary}
                                        />
                                        <Text style={[
                                            styles.courseTabText,
                                            { color: isActive ? '#fff' : theme.textSecondary }
                                        ]}>
                                            {cursoInfo?.nombre}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Banner Informativo Compacto */}
            {pagosPorVerificar > 0 ? (
                <TouchableOpacity
                    style={[styles.alertBannerCompact, { backgroundColor: darkMode ? 'rgba(239,68,68,0.1)' : '#fee2e2', borderColor: theme.danger + '40' }]}
                    onPress={() => setFilterEstado('pagado')}
                    activeOpacity={0.7}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.alertIconSmall, { backgroundColor: theme.danger }]}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{pagosPorVerificar}</Text>
                        </View>
                        <Text style={{ marginLeft: 10, fontWeight: '700', color: darkMode ? '#f87171' : '#b91c1c', fontSize: 13 }}>
                            {pagosPorVerificar} pago(s) pendientes de verificar
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.danger} />
                </TouchableOpacity>
            ) : (
                <View style={[styles.alertBannerCompact, { backgroundColor: darkMode ? 'rgba(16,185,129,0.08)' : '#ecfdf5', borderColor: theme.success + '30' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    <Text style={{ flex: 1, marginLeft: 8, fontWeight: '600', color: theme.success, fontSize: 13 }}>
                        ¡Todo al día! Pagos verificados.
                    </Text>
                    <Ionicons name="checkmark-done" size={16} color={theme.success} style={{ opacity: 0.5 }} />
                </View>
            )}

            {/* Lista */}
            <FlatList
                data={paginatedEstudiantes}
                renderItem={renderEstudiante}
                keyExtractor={(item) => item.estudiante_cedula}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="wallet-outline" size={48} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay pagos registrados</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={estudiantesFiltrados.length}
                        onPageChange={setCurrentPage}
                        theme={theme}
                        itemLabel="estudiantes"
                    />
                }
            />

            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}

            {/* MODAL DETALLE / RECHAZO */}
            <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => {
                if (viewMode === 'reject' || viewMode === 'verify') {
                    setViewMode('detail');
                } else {
                    setShowDetailModal(false);
                }
            }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => {
                                if (viewMode === 'reject' || viewMode === 'verify') {
                                    setViewMode('detail');
                                } else {
                                    setShowDetailModal(false);
                                }
                            }}>
                                <Ionicons name="arrow-back" size={24} color={theme.textMuted} style={{ marginRight: 10, display: viewMode === 'detail' ? 'none' : 'flex' }} />
                            </TouchableOpacity>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>
                                {viewMode === 'reject' ? 'Rechazar Pago' : viewMode === 'verify' ? 'Verificar Pago' : 'Detalle de Pago'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Ionicons name="close" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedPago && viewMode === 'detail' && (
                            <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
                                {/* Estado Badge Grande */}
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={[styles.estadoBadgeLarge, { backgroundColor: getEstadoColor(selectedPago.estado) + '20', borderColor: getEstadoColor(selectedPago.estado) }]}>
                                        <Ionicons name={getEstadoIcon(selectedPago.estado) as any} size={24} color={getEstadoColor(selectedPago.estado)} />
                                        <Text style={{ color: getEstadoColor(selectedPago.estado), fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                                            {selectedPago.estado.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Estudiante */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Estudiante</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Nombre" value={`${selectedPago.estudiante_apellido}, ${selectedPago.estudiante_nombre}`} theme={theme} />
                                    <DetailItem label="Cédula" value={selectedPago.estudiante_cedula} theme={theme} />
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Curso */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Curso</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Nombre" value={selectedPago.curso_nombre} theme={theme} />
                                    <DetailItem label="Código" value={selectedPago.codigo_matricula} theme={theme} />
                                    {selectedPago.curso_horario && (
                                        <DetailItem label="Horario" value={selectedPago.curso_horario} theme={theme} />
                                    )}
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Información de Pago */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Información de Pago</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Cuota" value={`${selectedPago.numero_cuota}`} theme={theme} />
                                    <DetailItem label="Monto" value={formatMonto(selectedPago.monto)} theme={theme} isCurrency />
                                    <DetailItem label="Vencimiento" value={formatDate(selectedPago.fecha_vencimiento)} theme={theme} />
                                    {selectedPago.fecha_pago && (
                                        <DetailItem label="Fecha Pago" value={formatDate(selectedPago.fecha_pago)} theme={theme} />
                                    )}
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Método de Pago */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Método de Pago</Text>
                                <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.inputBg, marginBottom: 15 }}>
                                    <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 8 }}>{selectedPago.metodo_pago}</Text>
                                    {selectedPago.numero_comprobante && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Comprobante: <Text style={{ fontWeight: '700' }}>{selectedPago.numero_comprobante}</Text></Text>
                                    )}
                                    {selectedPago.metodo_pago === 'transferencia' && selectedPago.banco_comprobante && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Banco: <Text style={{ fontWeight: '700' }}>{selectedPago.banco_comprobante}</Text></Text>
                                    )}
                                    {selectedPago.metodo_pago === 'efectivo' && selectedPago.recibido_por && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Recibido por: <Text style={{ fontWeight: '700' }}>{selectedPago.recibido_por}</Text></Text>
                                    )}
                                </View>

                                {/* Comprobante */}
                                {selectedPago.comprobante_pago_url && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                                            onPress={() => handleVerComprobante(selectedPago)}
                                        >
                                            <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                                            <Text style={{ color: theme.primary, fontWeight: '600', marginLeft: 8 }}>Ver Comprobante</Text>
                                        </TouchableOpacity>
                                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    </>
                                )}

                                {/* Verificación */}
                                {selectedPago.estado === 'verificado' && selectedPago.verificado_por_nombre && (
                                    <>
                                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Verificado Por</Text>
                                        <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.success + '10', borderWidth: 1, borderColor: theme.success, marginBottom: 15 }}>
                                            <Text style={{ color: theme.success, fontWeight: '700' }}>
                                                {selectedPago.verificado_por_nombre} {selectedPago.verificado_por_apellido}
                                            </Text>
                                            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                                                Fecha: {formatDate(selectedPago.fecha_verificacion)}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {/* Observaciones */}
                                {selectedPago.observaciones && (
                                    <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.warning + '10', borderWidth: 1, borderColor: theme.warning, marginBottom: 15 }}>
                                        <Text style={{ color: theme.warning, fontWeight: '700', marginBottom: 4 }}>Observaciones</Text>
                                        <Text style={{ color: theme.text }}>{selectedPago.observaciones}</Text>
                                    </View>
                                )}

                                {/* Acciones */}
                                {selectedPago.estado === 'pagado' && (
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity
                                            style={[styles.bigActionBtn, { backgroundColor: theme.success + '15', borderColor: theme.success, flex: 1 }]}
                                            onPress={() => handleVerificarPago(selectedPago)}
                                            disabled={procesando}
                                        >
                                            {procesando ? (
                                                <ActivityIndicator color={theme.success} />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                                                    <Text style={{ color: theme.success, fontWeight: '700', marginLeft: 6 }}>Verificar</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.bigActionBtn, { backgroundColor: theme.danger + '15', borderColor: theme.danger, flex: 1 }]}
                                            onPress={() => handleRechazarPago(selectedPago)}
                                            disabled={procesando}
                                        >
                                            <Ionicons name="close-circle" size={20} color={theme.danger} />
                                            <Text style={{ color: theme.danger, fontWeight: '700', marginLeft: 6 }}>Rechazar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}

                        {selectedPago && viewMode === 'reject' && (
                            <View style={{ marginTop: 20 }}>
                                <Text style={{ color: theme.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                                    Ingrese el motivo del rechazo para:
                                    {'\n'}
                                    <Text style={{ fontWeight: 'bold', color: theme.text }}>
                                        {selectedPago.estudiante_nombre} {selectedPago.estudiante_apellido}
                                    </Text>
                                </Text>

                                <TextInput
                                    style={[styles.textArea, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border, height: 120 }]}
                                    placeholder="Motivo del rechazo..."
                                    placeholderTextColor={theme.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    value={motivoRechazo}
                                    onChangeText={setMotivoRechazo}
                                    autoFocus // Workaround for better UX
                                />

                                <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 10, alignItems: 'center' }}
                                        onPress={() => setViewMode('detail')}
                                    >
                                        <Text style={{ color: theme.text }}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ flex: 1, padding: 12, backgroundColor: theme.danger, borderRadius: 10, alignItems: 'center' }}
                                        onPress={confirmarRechazo}
                                        disabled={procesando}
                                    >
                                        {procesando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar Rechazo</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* VISTA DE VERIFICACIÓN MASIVA (Smart Verification) */}
                        {pagoAVerificar && viewMode === 'verify' && (
                            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
                                <Text style={{ color: theme.textSecondary, marginBottom: 15, fontSize: 13 }}>
                                    {pagoAVerificar.estudiante_nombre} {pagoAVerificar.estudiante_apellido}
                                </Text>

                                {/* Resumen del Pago */}
                                <View style={{ backgroundColor: theme.success + '10', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.success + '20', marginBottom: 20 }}>
                                    <View style={styles.infoRow}>
                                        <Text style={{ fontSize: 13, color: theme.textMuted, width: 100 }}>Monto Total:</Text>
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.success }}>
                                            {(() => {
                                                const estudianteActual = estudiantes.find(e => e.estudiante_cedula === pagoAVerificar.estudiante_cedula);
                                                const cursoActual = estudianteActual?.cursos.find(c => c.id_curso === pagoAVerificar.id_curso);
                                                // Sumar cuotas seleccionadas (solo las que existen y son pagado)
                                                let total = 0;
                                                cuotasAVerificar.forEach(id => {
                                                    const p = cursoActual?.pagos.find(x => x.id_pago === id);
                                                    if (p) total += Number(p.monto);
                                                });
                                                return formatMonto(total);
                                            })()}
                                        </Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={{ fontSize: 13, color: theme.textMuted, width: 100 }}>Cuotas:</Text>
                                        <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>
                                            {cuotasAVerificar.length} cuota(s) seleccionada(s)
                                        </Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={{ fontSize: 13, color: theme.textMuted, width: 100 }}>Comprobante:</Text>
                                        <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>{pagoAVerificar.numero_comprobante || 'N/A'}</Text>
                                    </View>
                                </View>

                                {/* Selector de Cuotas */}
                                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 10 }}>
                                    ¿Cuántas cuotas desea verificar?
                                </Text>
                                <View style={{ backgroundColor: theme.inputBg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border }}>
                                    {(() => {
                                        const estudianteActual = estudiantes.find(e => e.estudiante_cedula === pagoAVerificar.estudiante_cedula);
                                        const cursoActual = estudianteActual?.cursos.find(c => c.id_curso === pagoAVerificar.id_curso);

                                        const cuotasDisponibles = cursoActual?.pagos
                                            .filter(p => p.numero_cuota >= pagoAVerificar.numero_cuota && p.estado === 'pagado')
                                            .sort((a, b) => a.numero_cuota - b.numero_cuota) || [];

                                        if (cuotasDisponibles.length === 0) {
                                            return <Text style={{ color: theme.textMuted, textAlign: 'center' }}>No hay más cuotas pendientes por verificar.</Text>;
                                        }

                                        return cuotasDisponibles.map((cuota) => {
                                            const isSelected = cuotasAVerificar.includes(cuota.id_pago);
                                            return (
                                                <TouchableOpacity
                                                    key={cuota.id_pago}
                                                    onPress={() => {
                                                        if (isSelected) {
                                                            setCuotasAVerificar(prev => prev.filter(id => id !== cuota.id_pago));
                                                        } else {
                                                            setCuotasAVerificar(prev => [...prev, cuota.id_pago]);
                                                        }
                                                    }}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        padding: 12,
                                                        borderBottomWidth: 1,
                                                        borderBottomColor: theme.border,
                                                        backgroundColor: isSelected ? theme.success + '08' : 'transparent'
                                                    }}
                                                >
                                                    <View style={{
                                                        width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
                                                        borderColor: isSelected ? theme.success : theme.textMuted,
                                                        backgroundColor: isSelected ? theme.success : 'transparent',
                                                        marginRight: 10,
                                                        alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                                                            {cuota.modalidad_pago === 'clases' ? `Clase ${cuota.numero_cuota}` : `Cuota ${cuota.numero_cuota}`}
                                                        </Text>
                                                        <Text style={{ fontSize: 11, color: theme.textMuted }}>
                                                            {formatMonto(cuota.monto)} - {formatDate(cuota.fecha_vencimiento)}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        });
                                    })()}
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border }}>
                                    <TouchableOpacity
                                        onPress={() => setViewMode('detail')}
                                        disabled={procesando}
                                        style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={confirmarVerificacionMasiva}
                                        disabled={procesando || cuotasAVerificar.length === 0}
                                        style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.success, alignItems: 'center', opacity: (procesando || cuotasAVerificar.length === 0) ? 0.6 : 1 }}
                                    >
                                        {procesando ? <ActivityIndicator color="#fff" size="small" /> : (
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                                Verificar {cuotasAVerificar.length > 0 ? `(${cuotasAVerificar.length})` : ''}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: 40 }} />
                            </ScrollView>

                        )}

                    </View>
                </View>
            </Modal>

            {/* VISOR DE ARCHIVOS INDEPENDIENTE (MODAL SUPERIOR) */}
            <Modal
                visible={!!archivoPreview}
                transparent
                animationType="fade"
                onRequestClose={() => setArchivoPreview(null)}
            >
                <View style={styles.absoluteVisor}>
                    <View style={styles.visorHeader}>
                        <TouchableOpacity onPress={() => setArchivoPreview(null)} style={styles.visorHeaderBtn}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={styles.visorTitle} numberOfLines={1}>
                                {archivoPreview?.titulo}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Desliza o usa el botón para cerrar</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => archivoPreview && Linking.openURL(archivoPreview.url)}
                            style={styles.visorHeaderBtn}
                        >
                            <Ionicons name="download-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                        {archivoPreview?.tipo === 'image' ? (
                            <Image
                                source={{ uri: archivoPreview.url }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                            />
                        ) : archivoPreview?.tipo === 'pdf' ? (
                            <WebView
                                source={{ uri: archivoPreview.url }}
                                style={{ flex: 1 }}
                                scalesPageToFit
                            />
                        ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                                <Ionicons name="document-text" size={80} color="#334155" />
                                <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20, fontSize: 16 }}>
                                    La vista previa no está disponible.
                                </Text>
                                <TouchableOpacity
                                    style={styles.visorActionBtn}
                                    onPress={() => archivoPreview && Linking.openURL(archivoPreview.url)}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Abrir Externamente</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ACCIONES DENTRO DEL VISOR */}
                    {selectedPago?.estado === 'pagado' && (
                        <View style={styles.visorActionsContainer}>
                            <TouchableOpacity
                                style={[styles.visorActionBtnLarge, { backgroundColor: '#10b981' }]}
                                onPress={() => handleVerificarPago(selectedPago)}
                                disabled={procesando}
                            >
                                {procesando ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                                        <Text style={styles.visorActionText}>Aprobar Pago</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.visorActionBtnLarge, { backgroundColor: '#ef4444' }]}
                                onPress={() => {
                                    setArchivoPreview(null); // Cerrar visor 
                                    handleRechazarPago(selectedPago); // Configura modo rechazo
                                    setShowDetailModal(true); // Reabrir modal detalle
                                }}
                                disabled={procesando}
                            >
                                <Ionicons name="close-circle" size={22} color="#fff" />
                                <Text style={styles.visorActionText}>Rechazar</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal >

        </View >
    )
}



const DetailItem = ({ label, value, theme, isCurrency }: any) => (
    <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: isCurrency ? 16 : 14, color: isCurrency ? theme.primary : theme.text, fontWeight: isCurrency ? '700' : '500' }}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    summaryCard: {
        paddingTop: 10,
        paddingBottom: 16,
        paddingHorizontal: 15,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: -2 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 44 },
    searchInput: { flex: 1, color: '#fff', paddingHorizontal: 10, fontSize: 15 },
    filterRow: { flexDirection: 'row', gap: 6, paddingRight: 20 },
    filterButton: {
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 90,
        alignItems: 'center'
    },
    filterButtonText: { fontSize: 12.5, textAlign: 'center', fontWeight: '600' },

    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginHorizontal: 20,
        marginTop: 15,
        borderRadius: 12,
        borderWidth: 1
    },
    alertIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    alertBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#dc2626',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },

    listContent: { padding: 15, paddingBottom: 10 },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    studentName: { fontSize: 16, fontWeight: '700' },
    estadoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, gap: 4 },
    estadoText: { fontSize: 10, fontWeight: '700' },
    divider: { height: 1, width: '100%', marginVertical: 10 },
    pickerContainer: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    pagoInfo: { flexDirection: 'row', gap: 15, marginTop: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, gap: 6 },

    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { marginTop: 10, fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    estadoBadgeLarge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 5 },
    detailGrid: { marginBottom: 10 },
    docBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 15 },
    bigActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    textArea: { height: 100, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 15, textAlignVertical: 'top', marginBottom: 20 },

    // Absolute Visor Styles
    absoluteVisor: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 9999,
    },
    visorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    visorHeaderBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    visorTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    visorActionBtn: {
        marginTop: 20,
        backgroundColor: '#ef4444',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 25,
    },
    visorActionsContainer: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    visorActionBtnLarge: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    visorActionText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },

    // Course Tabs Styles
    courseTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginRight: 8,
        borderWidth: 1,
        gap: 6
    },
    courseTabText: {
        fontSize: 12,
        fontWeight: '700'
    },
    alertBannerCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 15,
        marginVertical: 8,
        borderRadius: 8,
        borderWidth: 1
    },
    alertIconSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    cardCompact: {
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        marginBottom: 10,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    cardHeaderCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    studentNameCompact: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
    estadoBadgeSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, gap: 3 },
    estadoTextSmall: { fontSize: 9, fontWeight: '800' },
    cardFooterCompact: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1
    },
    btnCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1
    }
});
