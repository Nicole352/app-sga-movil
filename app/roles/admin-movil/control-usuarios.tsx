import React, { useState, useEffect, useCallback } from 'react';
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
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width, height } = Dimensions.get('window');

interface Usuario {
    id_usuario: number;
    cedula: string;
    nombre: string;
    apellido: string;
    email: string | null;
    username: string | null;
    telefono: string | null;
    estado: 'activo' | 'inactivo' | 'pendiente';
    fecha_ultima_conexion: string | null;
    fecha_registro: string;
    nombre_rol: string;
    foto_perfil?: string | null;
    creado_por?: string;
    fecha_creacion?: string;
    modificado_por?: string;
    fecha_modificacion?: string;
    cursos_matriculados?: number;
    pagos_pendientes?: number;
    pagos_completados?: number;
    cursos_asignados?: number;
    estudiantes_activos?: number;
    matriculas_aprobadas?: number;
    pagos_verificados?: number;
    total_acciones?: number;
    cuenta_bloqueada?: boolean;
    motivo_bloqueo?: string | null;
    fecha_bloqueo?: string | null;
}

interface Sesion {
    id_sesion: string;
    user_agent: string;
    fecha_inicio: string;
    fecha_expiracion: string;
    fecha_cierre?: string;
    activa: boolean;
}

interface Accion {
    id_auditoria?: number;
    tabla_afectada?: string;
    operacion?: 'INSERT' | 'UPDATE' | 'DELETE';
    id_registro?: number;
    descripcion?: string;
    detalles?: string | any;
    fecha_operacion?: string;
    tipo_accion?: string;
    fecha_hora?: string;
}

export default function ControlUsuariosScreen() {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Datos
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);

    // Filtros
    const [search, setSearch] = useState('');
    const [rolFilter, setRolFilter] = useState('todos');
    const [estadoFilter, setEstadoFilter] = useState('todos');

    // Paginación
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Modal de detalle
    const [showModal, setShowModal] = useState(false);
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
    const [tabActiva, setTabActiva] = useState<'info' | 'sesiones' | 'acciones'>('info');
    const [sesiones, setSesiones] = useState<Sesion[]>([]);
    const [acciones, setAcciones] = useState<Accion[]>([]);
    const [loadingModal, setLoadingModal] = useState(false);

    // Modal de confirmación
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [accionConfirmar, setAccionConfirmar] = useState<{ tipo: 'activar' | 'desactivar' | 'resetear' | 'bloquear' | 'desbloquear' | 'desbloqueo-temporal', usuario: Usuario } | null>(null);
    const [motivoBloqueo, setMotivoBloqueo] = useState('');

    // Modal de credenciales
    const [showCredencialesModal, setShowCredencialesModal] = useState(false);
    const [credenciales, setCredenciales] = useState<{ username: string, password_temporal: string } | null>(null);

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
            cargarUsuarios();
        }, [search, rolFilter, estadoFilter, page])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        getDarkMode().then(setDarkMode);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    const cargarUsuarios = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            if (!token) return;

            const response = await fetch(
                `${API_URL}/usuarios?search=${search}&rol=${rolFilter}&estado=${estadoFilter}&page=${page}&limit=10`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Error al cargar usuarios');
            }

            const data = await response.json();

            // Obtener ID del usuario logueado
            let idUsuarioLogueado = null;
            try {
                const meResponse = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (meResponse.ok) {
                    const meData = await meResponse.json();
                    idUsuarioLogueado = meData.id_usuario;
                }
            } catch (err) {
                console.error('Error obteniendo usuario logueado:', err);
            }

            // SEGURIDAD: Filtrar SuperAdmin, Administrativo y el admin logueado
            const usuariosFiltrados = (data.usuarios || []).filter(
                (usuario: Usuario) =>
                    usuario.nombre_rol?.toLowerCase() !== 'superadmin' &&
                    usuario.nombre_rol?.toLowerCase() !== 'administrativo' &&
                    usuario.id_usuario !== idUsuarioLogueado
            );

            setUsuarios(usuariosFiltrados);
            setTotalPages(data.totalPages || 1);
            setTotalItems(usuariosFiltrados.length);
        } catch (err: any) {
            console.error('Error al cargar usuarios:', err);
            Alert.alert('Error', 'No se pudieron cargar los usuarios');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const formatFecha = (fecha: string | null) => {
        if (!fecha) return 'Nunca';
        return new Date(fecha).toLocaleString('es-EC', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRolColor = (rol: string) => {
        switch (rol?.toLowerCase()) {
            case 'docente':
                return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
            case 'estudiante':
                return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
            default:
                return { bg: 'rgba(100, 116, 139, 0.15)', text: '#64748b', border: 'rgba(100, 116, 139, 0.3)' };
        }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'activo':
                return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
            case 'inactivo':
                return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
            case 'pendiente':
                return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
            default:
                return { bg: 'rgba(100, 116, 139, 0.15)', text: '#64748b', border: 'rgba(100, 116, 139, 0.3)' };
        }
    };

    const verDetalle = async (usuario: Usuario) => {
        setUsuarioSeleccionado(usuario);
        setShowModal(true);
        setTabActiva('info');
        setLoadingModal(true);

        try {
            const token = await getToken();

            // Cargar datos completos del usuario
            try {
                const usuarioRes = await fetch(`${API_URL}/usuarios/${usuario.id_usuario}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (usuarioRes.ok) {
                    const usuarioData = await usuarioRes.json();
                    setUsuarioSeleccionado(usuarioData.usuario);
                }
            } catch (err) {
                console.error('Error al cargar usuario:', err);
            }

            // Cargar sesiones
            try {
                const sesionesRes = await fetch(`${API_URL}/usuarios/${usuario.id_usuario}/sesiones?limit=10`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (sesionesRes.ok) {
                    const sesionesData = await sesionesRes.json();
                    setSesiones(sesionesData.sesiones || []);
                }
            } catch (err) {
                console.error('Error al cargar sesiones:', err);
                setSesiones([]);
            }

            // Cargar historial de acciones
            try {
                const historialRes = await fetch(`${API_URL}/auditoria/usuario/${usuario.id_usuario}/historial-detallado?tipo=todas&limite=50`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (historialRes.ok) {
                    const historialData = await historialRes.json();
                    setAcciones(historialData.data?.acciones || []);
                }
            } catch (err) {
                console.error('Error al cargar historial:', err);
                setAcciones([]);
            }
        } catch (err) {
            console.error('Error al cargar datos del modal:', err);
        } finally {
            setLoadingModal(false);
        }
    };

    const confirmarCambioEstado = (usuario: Usuario) => {
        const nuevoEstado = usuario.estado === 'activo' ? 'desactivar' : 'activar';
        setAccionConfirmar({ tipo: nuevoEstado, usuario });
        setShowConfirmModal(true);
    };

    const confirmarBloqueo = (usuario: Usuario) => {
        setAccionConfirmar({ tipo: 'bloquear', usuario });
        setMotivoBloqueo('');
        setShowConfirmModal(true);
    };

    const confirmarDesbloqueo = (usuario: Usuario) => {
        setAccionConfirmar({ tipo: 'desbloquear', usuario });
        setShowConfirmModal(true);
    };

    const confirmarDesbloqueoTemporal = (usuario: Usuario) => {
        setAccionConfirmar({ tipo: 'desbloqueo-temporal', usuario });
        setShowConfirmModal(true);
    };

    const resetearPassword = (usuario: Usuario) => {
        setAccionConfirmar({ tipo: 'resetear', usuario });
        setShowConfirmModal(true);
    };

    const ejecutarAccion = async () => {
        if (!accionConfirmar) return;

        try {
            const token = await getToken();
            let response;

            if (accionConfirmar.tipo === 'bloquear') {
                response = await fetch(`${API_URL}/usuarios/${accionConfirmar.usuario.id_usuario}/bloquear`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ motivo: motivoBloqueo || 'Bloqueo manual por administrador' })
                });
            } else if (accionConfirmar.tipo === 'desbloquear') {
                response = await fetch(`${API_URL}/usuarios/${accionConfirmar.usuario.id_usuario}/desbloquear`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } else if (accionConfirmar.tipo === 'desbloqueo-temporal') {
                response = await fetch(`${API_URL}/usuarios/${accionConfirmar.usuario.id_usuario}/desbloqueo-temporal`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } else if (accionConfirmar.tipo === 'activar' || accionConfirmar.tipo === 'desactivar') {
                const nuevoEstado = accionConfirmar.tipo === 'activar' ? 'activo' : 'inactivo';
                response = await fetch(`${API_URL}/usuarios/${accionConfirmar.usuario.id_usuario}/estado`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ estado: nuevoEstado })
                });
            } else if (accionConfirmar.tipo === 'resetear') {
                response = await fetch(`${API_URL}/usuarios/${accionConfirmar.usuario.id_usuario}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response && response.ok) {
                    const data = await response.json();
                    setCredenciales(data.credenciales);
                    setShowConfirmModal(false);
                    setAccionConfirmar(null);
                    setShowCredencialesModal(true);
                    Alert.alert('Éxito', 'Contraseña reseteada correctamente');
                    await cargarUsuarios();
                }
                return;
            }

            if (response && !response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al ejecutar acción');
            }

            await cargarUsuarios();
            setShowConfirmModal(false);
            setAccionConfirmar(null);
            setMotivoBloqueo('');
            Alert.alert('Éxito', 'Acción realizada correctamente');
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Error al ejecutar acción');
        }
    };

    const getInitials = (nombre: string, apellido: string) => {
        return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
    };

    const renderUsuarioCard = ({ item }: { item: Usuario }) => {
        const rolColors = getRolColor(item.nombre_rol);
        const estadoColors = getEstadoColor(item.estado);

        return (
            <View style={[styles.userCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.userHeader}>
                    <View style={styles.userAvatar}>
                        {item.foto_perfil ? (
                            <Image source={{ uri: item.foto_perfil }} style={styles.avatarImage} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}>
                                <Text style={[styles.avatarText, { color: theme.primary }]}>
                                    {getInitials(item.nombre, item.apellido)}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.text }]}>
                            {item.apellido + ', ' + item.nombre}
                        </Text>
                        <Text style={[styles.userCedula, { color: theme.textMuted }]}>{item.cedula}</Text>
                        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.email || item.username || '-'}</Text>
                    </View>
                </View>

                <View style={styles.userBadges}>
                    <View style={[styles.badge, { backgroundColor: rolColors.bg, borderColor: rolColors.border }]}>
                        <Text style={[styles.badgeText, { color: rolColors.text }]}>{item.nombre_rol}</Text>
                    </View>
                    {item.cuenta_bloqueada ? (
                        <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                            <Ionicons name="lock-closed" size={12} color="#ef4444" />
                            <Text style={[styles.badgeText, { color: '#ef4444', marginLeft: 4 }]}>BLOQUEADO</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, { backgroundColor: estadoColors.bg, borderColor: estadoColors.border }]}>
                            <Text style={[styles.badgeText, { color: estadoColors.text }]}>{item.estado.toUpperCase()}</Text>
                        </View>
                    )}
                </View>

                <Text style={[styles.userLastConnection, { color: theme.textMuted }]}>
                    {'Última conexión: ' + formatFecha(item.fecha_ultima_conexion)}
                </Text>

                <View style={styles.userActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#3b82f6' + '15', borderColor: '#3b82f6' + '30' }]}
                        onPress={() => verDetalle(item)}
                    >
                        <Ionicons name="eye" size={18} color="#3b82f6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, {
                            backgroundColor: (item.estado === 'activo' ? '#ef4444' : '#10b981') + '15',
                            borderColor: (item.estado === 'activo' ? '#ef4444' : '#10b981') + '30'
                        }]}
                        onPress={() => confirmarCambioEstado(item)}
                    >
                        <Ionicons
                            name={item.estado === 'activo' ? 'power' : 'checkmark-circle'}
                            size={18}
                            color={item.estado === 'activo' ? '#ef4444' : '#10b981'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, {
                            backgroundColor: (item.cuenta_bloqueada ? '#10b981' : '#ef4444') + '15',
                            borderColor: (item.cuenta_bloqueada ? '#10b981' : '#ef4444') + '30'
                        }]}
                        onPress={() => item.cuenta_bloqueada ? confirmarDesbloqueo(item) : confirmarBloqueo(item)}
                    >
                        <Ionicons
                            name={item.cuenta_bloqueada ? 'lock-open' : 'lock-closed'}
                            size={18}
                            color={item.cuenta_bloqueada ? '#10b981' : '#ef4444'}
                        />
                    </TouchableOpacity>

                    {item.cuenta_bloqueada ? (
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#ff9800' + '15', borderColor: '#ff9800' + '30' }]}
                            onPress={() => confirmarDesbloqueoTemporal(item)}
                        >
                            <Ionicons name="time" size={18} color="#ff9800" />
                        </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#f59e0b' + '15', borderColor: '#f59e0b' + '30' }]}
                        onPress={() => resetearPassword(item)}
                    >
                        <Ionicons name="key" size={18} color="#f59e0b" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* HEADER CLEAN NIKE EFFECT */}
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Control de Usuarios</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona todos los usuarios del sistema</Text>
            </View>

            {/* FILTROS */}
            <View style={styles.filters}>
                <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Buscar por nombre, identificación o email..."
                        placeholderTextColor={theme.textMuted}
                        value={search}
                        onChangeText={(text) => {
                            setSearch(text);
                            setPage(1);
                        }}
                    />
                </View>

                <View style={styles.filterRow}>
                    <View style={{ flex: 1 }}>
                        <CompactPicker
                            items={[
                                { label: 'Todos los roles', value: 'todos' },
                                { label: 'Docente', value: 'docente' },
                                { label: 'Estudiante', value: 'estudiante' },
                            ]}
                            selectedValue={rolFilter}
                            onValueChange={(val) => {
                                setRolFilter(val);
                                setPage(1);
                            }}
                            theme={theme}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <CompactPicker
                            items={[
                                { label: 'Todos los estados', value: 'todos' },
                                { label: 'Activo', value: 'activo' },
                                { label: 'Inactivo', value: 'inactivo' },
                                { label: 'Bloqueado', value: 'bloqueado' },
                            ]}
                            selectedValue={estadoFilter}
                            onValueChange={(val) => {
                                setEstadoFilter(val);
                                setPage(1);
                            }}
                            theme={theme}
                        />
                    </View>
                </View>
            </View>

            {/* LISTA DE USUARIOS */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando usuarios...</Text>
                </View>
            ) : usuarios.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="people" size={64} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No se encontraron usuarios</Text>
                </View>
            ) : (
                <>
                    <FlatList
                        data={usuarios}
                        renderItem={renderUsuarioCard}
                        keyExtractor={(item) => item.id_usuario.toString()}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => {
                                setRefreshing(true);
                                cargarUsuarios();
                            }} tintColor={theme.primary} />
                        }
                        ListFooterComponent={
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                onPageChange={setPage}
                                theme={theme}
                                itemLabel="usuarios"
                            />
                        }
                    />
                </>
            )}

            {/* MODAL DE DETALLE - MEJORADO Y COMPACTO */}
            <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
                    {/* HEADER FIJO */}
                    <View style={[styles.modalHeader, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Detalle del Usuario</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* TABS FIJOS */}
                    <View style={[styles.tabs, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                        <TouchableOpacity
                            style={[styles.tab, tabActiva === 'info' && { borderBottomColor: theme.primary }]}
                            onPress={() => setTabActiva('info')}
                        >
                            <Ionicons name="person" size={18} color={tabActiva === 'info' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabText, { color: tabActiva === 'info' ? theme.primary : theme.textMuted }]}>Info</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, tabActiva === 'sesiones' && { borderBottomColor: theme.primary }]}
                            onPress={() => setTabActiva('sesiones')}
                        >
                            <Ionicons name="desktop" size={18} color={tabActiva === 'sesiones' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabText, { color: tabActiva === 'sesiones' ? theme.primary : theme.textMuted }]}>Sesiones</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, tabActiva === 'acciones' && { borderBottomColor: theme.primary }]}
                            onPress={() => setTabActiva('acciones')}
                        >
                            <Ionicons name="list" size={18} color={tabActiva === 'acciones' ? theme.primary : theme.textMuted} />
                            <Text style={[styles.tabText, { color: tabActiva === 'acciones' ? theme.primary : theme.textMuted }]}>Acciones</Text>
                        </TouchableOpacity>
                    </View>

                    {/* CONTENIDO SCROLLABLE */}
                    {loadingModal ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                            {tabActiva === 'info' && usuarioSeleccionado && (
                                <View style={styles.infoTab}>
                                    <View style={[styles.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                        <Text style={[styles.infoCardTitle, { color: theme.text }]}>Información Personal</Text>
                                        <InfoRow label="Nombre" value={`${usuarioSeleccionado.nombre} ${usuarioSeleccionado.apellido}`} theme={theme} />
                                        <InfoRow label="Cédula" value={usuarioSeleccionado.cedula} theme={theme} />
                                        <InfoRow label="Email" value={usuarioSeleccionado.email || '-'} theme={theme} />
                                        <InfoRow label="Teléfono" value={usuarioSeleccionado.telefono || '-'} theme={theme} />
                                        <InfoRow label="Rol" value={usuarioSeleccionado.nombre_rol} theme={theme} />
                                        <InfoRow label="Estado" value={usuarioSeleccionado.estado} theme={theme} />
                                        <InfoRow label="Fecha Registro" value={formatFecha(usuarioSeleccionado.fecha_registro)} theme={theme} isLast />
                                    </View>

                                    {usuarioSeleccionado.nombre_rol?.toLowerCase() === 'estudiante' && (
                                        <View style={[styles.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                            <Text style={[styles.infoCardTitle, { color: theme.text }]}>Información Académica</Text>
                                            <InfoRow label="Cursos Matriculados" value={`${usuarioSeleccionado.cursos_matriculados || 0}`} theme={theme} />
                                            <InfoRow label="Pagos Pendientes" value={`${usuarioSeleccionado.pagos_pendientes || 0}`} theme={theme} />
                                            <InfoRow label="Pagos Completados" value={`${usuarioSeleccionado.pagos_completados || 0}`} theme={theme} isLast />
                                        </View>
                                    )}

                                    {usuarioSeleccionado.nombre_rol?.toLowerCase() === 'docente' && (
                                        <View style={[styles.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                            <Text style={[styles.infoCardTitle, { color: theme.text }]}>Información Académica</Text>
                                            <InfoRow label="Cursos Asignados" value={`${usuarioSeleccionado.cursos_asignados || 0}`} theme={theme} />
                                            <InfoRow label="Estudiantes Activos" value={`${usuarioSeleccionado.estudiantes_activos || 0}`} theme={theme} isLast />
                                        </View>
                                    )}

                                    {usuarioSeleccionado.cuenta_bloqueada ? (
                                        <View style={[styles.infoCard, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' }]}>
                                            <Text style={[styles.infoCardTitle, { color: '#ef4444' }]}>Bloqueo Financiero</Text>
                                            <InfoRow label="Motivo" value={usuarioSeleccionado.motivo_bloqueo || '-'} theme={theme} />
                                            <InfoRow label="Fecha Bloqueo" value={formatFecha(usuarioSeleccionado.fecha_bloqueo ?? null)} theme={theme} isLast />
                                        </View>
                                    ) : null}
                                </View>
                            )}

                            {tabActiva === 'sesiones' && (
                                <View style={styles.sesionesList}>
                                    {sesiones.length === 0 ? (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="desktop" size={48} color={theme.textMuted} />
                                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay sesiones registradas</Text>
                                        </View>
                                    ) : (
                                        sesiones.map((sesion, index) => (
                                            <View key={index} style={[styles.sesionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                                <View style={styles.sesionHeader}>
                                                    <Ionicons name="desktop" size={18} color={theme.primary} />
                                                    <Text style={[styles.sesionDevice, { color: theme.text }]} numberOfLines={1}>{sesion.user_agent}</Text>
                                                </View>
                                                <View style={styles.sesionInfo}>
                                                    <Text style={[styles.sesionLabel, { color: theme.textMuted }]}>{'Inicio: ' + formatFecha(sesion.fecha_inicio)}</Text>
                                                    <Text style={[styles.sesionLabel, { color: theme.textMuted }]}>{'Expira: ' + formatFecha(sesion.fecha_expiracion)}</Text>
                                                    {sesion.fecha_cierre && (
                                                        <Text style={[styles.sesionLabel, { color: theme.textMuted }]}>{'Cierre: ' + formatFecha(sesion.fecha_cierre)}</Text>
                                                    )}
                                                </View>
                                                <View style={[styles.sesionStatus, { backgroundColor: sesion.activa ? '#10b981' + '20' : '#ef4444' + '20' }]}>
                                                    <Text style={{ color: sesion.activa ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: '600' }}>
                                                        {sesion.activa ? 'ACTIVA' : 'CERRADA'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}

                            {tabActiva === 'acciones' && (
                                <View style={styles.accionesList}>
                                    {acciones.length === 0 ? (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="list" size={48} color={theme.textMuted} />
                                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay acciones registradas</Text>
                                        </View>
                                    ) : (
                                        acciones.map((accion, index) => (
                                            <View key={index} style={[styles.accionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                                <View style={styles.accionHeader}>
                                                    <Text style={[styles.accionTipo, { color: theme.primary }]} numberOfLines={1}>
                                                        {accion.tipo_accion || accion.operacion || 'Acción'}
                                                    </Text>
                                                    <Text style={[styles.accionFecha, { color: theme.textMuted }]}>
                                                        {formatFecha(accion.fecha_hora || accion.fecha_operacion || null)}
                                                    </Text>
                                                </View>
                                                {accion.descripcion && (
                                                    <Text style={[styles.accionDescripcion, { color: theme.text }]} numberOfLines={2}>{accion.descripcion}</Text>
                                                )}
                                                {accion.tabla_afectada && (
                                                    <Text style={[styles.accionTabla, { color: theme.textMuted }]}>{'Tabla: ' + accion.tabla_afectada}</Text>
                                                )}
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </SafeAreaView>
            </Modal>

            {/* MODAL DE CONFIRMACIÓN */}
            <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
                <View style={styles.confirmModalOverlay}>
                    <View style={[styles.confirmModalContent, { backgroundColor: theme.cardBg }]}>
                        <Text style={[styles.confirmModalTitle, { color: theme.text }]}>
                            {accionConfirmar?.tipo === 'activar' && 'Activar Usuario'}
                            {accionConfirmar?.tipo === 'desactivar' && 'Desactivar Usuario'}
                            {accionConfirmar?.tipo === 'bloquear' && 'Bloquear Cuenta'}
                            {accionConfirmar?.tipo === 'desbloquear' && 'Desbloquear Cuenta'}
                            {accionConfirmar?.tipo === 'desbloqueo-temporal' && 'Desbloqueo Temporal (24h)'}
                            {accionConfirmar?.tipo === 'resetear' && 'Resetear Contraseña'}
                        </Text>
                        <Text style={[styles.confirmModalText, { color: theme.textSecondary }]}>
                            {accionConfirmar?.tipo === 'activar' && `¿Estás seguro de activar a ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}?`}
                            {accionConfirmar?.tipo === 'desactivar' && `¿Estás seguro de desactivar a ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}?`}
                            {accionConfirmar?.tipo === 'bloquear' && `¿Estás seguro de bloquear la cuenta de ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}?`}
                            {accionConfirmar?.tipo === 'desbloquear' && `¿Estás seguro de desbloquear la cuenta de ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}?`}
                            {accionConfirmar?.tipo === 'desbloqueo-temporal' && `¿Desbloquear temporalmente por 24 horas a ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}?`}
                            {accionConfirmar?.tipo === 'resetear' && `¿Resetear la contraseña de ${accionConfirmar.usuario.nombre} ${accionConfirmar.usuario.apellido}? Se generará una nueva contraseña temporal.`}
                        </Text>

                        {accionConfirmar?.tipo === 'bloquear' && (
                            <TextInput
                                style={[styles.motivoInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                                placeholder="Motivo del bloqueo (opcional)"
                                placeholderTextColor={theme.textMuted}
                                value={motivoBloqueo}
                                onChangeText={setMotivoBloqueo}
                                multiline
                            />
                        )}

                        <View style={styles.confirmModalButtons}>
                            <TouchableOpacity
                                style={[styles.confirmModalButton, { backgroundColor: theme.border }]}
                                onPress={() => {
                                    setShowConfirmModal(false);
                                    setAccionConfirmar(null);
                                    setMotivoBloqueo('');
                                }}
                            >
                                <Text style={[styles.confirmModalButtonText, { color: theme.text }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmModalButton, { backgroundColor: theme.primary }]}
                                onPress={ejecutarAccion}
                            >
                                <Text style={[styles.confirmModalButtonText, { color: '#fff' }]}>Confirmar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL DE CREDENCIALES */}
            <Modal visible={showCredencialesModal} transparent animationType="fade" onRequestClose={() => setShowCredencialesModal(false)}>
                <View style={styles.confirmModalOverlay}>
                    <View style={[styles.confirmModalContent, { backgroundColor: theme.cardBg }]}>
                        <Ionicons name="checkmark-circle" size={64} color={theme.success} style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={[styles.confirmModalTitle, { color: theme.text, textAlign: 'center' }]}>Contraseña Reseteada</Text>
                        <Text style={[styles.confirmModalText, { color: theme.textSecondary, textAlign: 'center', marginBottom: 20 }]}>
                            Nuevas credenciales generadas:
                        </Text>

                        <View style={[styles.credencialesBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                            <View style={styles.credencialRow}>
                                <Text style={[styles.credencialLabel, { color: theme.textMuted }]}>Usuario:</Text>
                                <Text style={[styles.credencialValue, { color: theme.text }]}>{credenciales?.username}</Text>
                            </View>
                            <View style={styles.credencialRow}>
                                <Text style={[styles.credencialLabel, { color: theme.textMuted }]}>Contraseña:</Text>
                                <Text style={[styles.credencialValue, { color: theme.primary, fontWeight: '700' }]}>{credenciales?.password_temporal}</Text>
                            </View>
                        </View>

                        <Text style={[styles.credencialesNote, { color: theme.textMuted }]}>
                            ⚠️ El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                        </Text>

                        <TouchableOpacity
                            style={[styles.confirmModalButton, { backgroundColor: theme.primary, marginTop: 20, width: '100%', flex: 0 }]}
                            onPress={() => {
                                setShowCredencialesModal(false);
                                setCredenciales(null);
                            }}
                        >
                            <Text style={[styles.confirmModalButtonText, { color: '#fff' }]}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Componente auxiliar para las filas de información
const InfoRow = ({ label, value, theme, isLast = false }: { label: string, value: string | null | undefined, theme: any, isLast?: boolean }) => (
    <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}:</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        marginBottom: 4,
        paddingTop: 16,
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
    headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, marginBottom: 16 },
    filters: {
        padding: 20,
        gap: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        height: 48,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 12,
    },
    listContent: {
        padding: 20,
        paddingTop: 0,
    },
    userCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        marginBottom: 8,
    },
    userHeader: {
        flexDirection: 'row',
        marginBottom: 4,
        alignItems: 'center',
    },
    userAvatar: {
        marginRight: 8,
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 0,
    },
    userCedula: {
        fontSize: 11,
        marginBottom: 0,
    },
    userEmail: {
        fontSize: 10,
        opacity: 0.8,
    },
    userBadges: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: 6,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '600',
    },
    userLastConnection: {
        fontSize: 10,
        marginBottom: 6,
    },
    userActions: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    closeButton: {
        padding: 4,
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
    },
    infoTab: {
        padding: 16,
    },
    infoCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    infoCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#ef4444',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    infoLabel: {
        fontSize: 12,
        flex: 1,
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    sesionesList: {
        padding: 16,
    },
    sesionCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    sesionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    sesionDevice: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    sesionInfo: {
        gap: 3,
        marginBottom: 6,
    },
    sesionLabel: {
        fontSize: 11,
    },
    sesionStatus: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    accionesList: {
        padding: 16,
    },
    accionCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    accionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    accionTipo: {
        fontSize: 13,
        fontWeight: '700',
        flex: 1,
    },
    accionFecha: {
        fontSize: 10,
    },
    accionDescripcion: {
        fontSize: 12,
        marginBottom: 3,
    },
    accionTabla: {
        fontSize: 10,
    },
    confirmModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    confirmModalContent: {
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    confirmModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
    },
    confirmModalText: {
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20,
    },
    motivoInput: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        fontSize: 14,
        marginBottom: 20,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    confirmModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmModalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmModalButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
    credencialesBox: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginBottom: 14,
    },
    credencialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    credencialLabel: {
        fontSize: 13,
    },
    credencialValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    credencialesNote: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
});
