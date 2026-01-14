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
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
// import { Picker } from '@react-native-picker/picker'; // Removed native picker
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

interface Course {
    id_curso: number;
    codigo_curso: string;
    id_tipo_curso?: number;
    nombre: string;
    descripcion?: string;
    horario: string;
    capacidad_maxima: number;
    cupos_disponibles?: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: 'planificado' | 'activo' | 'finalizado' | 'cancelado';
}

interface TipoCurso {
    id_tipo_curso: number;
    nombre: string;
    duracion_meses?: number;
    descripcion?: string;
}

export default function AdminCursosScreen() {
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cursos, setCursos] = useState<Course[]>([]);
    const [filteredCursos, setFilteredCursos] = useState<Course[]>([]);
    const [tiposCursos, setTiposCursos] = useState<TipoCurso[]>([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Estado Modal CRUD
    const [showModal, setShowModal] = useState(false);
    const [selectedCurso, setSelectedCurso] = useState<Course | null>(null);
    const [saving, setSaving] = useState(false);

    // Form Vars
    const [idTipoCurso, setIdTipoCurso] = useState<string>(''); // For Picker
    const [nombre, setNombre] = useState('');
    const [codigo, setCodigo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [capacidad, setCapacidad] = useState('');
    const [horario, setHorario] = useState('matutino');
    const [estado, setEstado] = useState('activo');

    // Fechas
    const [fechaInicio, setFechaInicio] = useState(new Date());
    const [fechaFin, setFechaFin] = useState(new Date());

    const [showPickerInicio, setShowPickerInicio] = useState(false);
    const [showPickerFin, setShowPickerFin] = useState(false);

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
            fetchCursos();
            fetchTiposCursos();
        }, [])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        getDarkMode().then(setDarkMode);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    useEffect(() => {
        filterData();
    }, [searchTerm, filterEstado, cursos]);

    // Reset form on open
    useEffect(() => {
        if (showModal) {
            if (selectedCurso) {
                setIdTipoCurso(selectedCurso.id_tipo_curso?.toString() || '');
                setNombre(selectedCurso.nombre || '');
                setCodigo(selectedCurso.codigo_curso || '');
                setDescripcion(selectedCurso.descripcion || '');
                setCapacidad(selectedCurso.capacidad_maxima?.toString() || '');
                setHorario(selectedCurso.horario || 'matutino');
                setEstado(selectedCurso.estado || 'activo');
                setFechaInicio(selectedCurso.fecha_inicio ? new Date(selectedCurso.fecha_inicio) : new Date());
                setFechaFin(selectedCurso.fecha_fin ? new Date(selectedCurso.fecha_fin) : new Date());
            } else {
                setIdTipoCurso('');
                setNombre('');
                setCodigo('');
                setDescripcion('');
                setCapacidad('');
                setHorario('matutino');
                setEstado('activo');
                setFechaInicio(new Date());
                setFechaFin(new Date());
            }
        }
    }, [showModal, selectedCurso]);

    const fetchTiposCursos = async () => {
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/tipos-cursos?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTiposCursos(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error("Error fetching types", e);
        }
    };

    const generateInitials = (name: string) => {
        return name.split(' ').map(w => w.charAt(0).toUpperCase()).join('').substring(0, 2);
    };

    const generateCode = (tipoId: string) => {
        const tipo = tiposCursos.find(t => t.id_tipo_curso.toString() === tipoId);
        if (!tipo) return;

        const initials = generateInitials(tipo.nombre);
        // Filtrar cursos existentes con esas iniciales
        const existing = cursos.filter(c => c.codigo_curso && c.codigo_curso.startsWith(initials));
        const nextNum = existing.length + 1;
        const newCode = `${initials}-${nextNum.toString().padStart(3, '0')}`;
        setCodigo(newCode);
    };

    const calculateEndDate = (start: Date, months: number) => {
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);
        setFechaFin(end);
    };

    const handleTipoChange = (val: string) => {
        setIdTipoCurso(val);
        const tipo = tiposCursos.find(t => t.id_tipo_curso.toString() === val);
        if (tipo) {
            setNombre(tipo.nombre);
            generateCode(val);
            if (tipo.duracion_meses) {
                calculateEndDate(fechaInicio, tipo.duracion_meses);
            }
        }
    };

    const fetchCursos = async () => {
        try {
            const token = await getToken();
            if (!token) return;
            const response = await fetch(`${API_URL}/cursos?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data) ? data : (data.rows || data.data || []);
                setCursos(items);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterData = () => {
        let result = cursos;
        if (filterEstado !== 'todos') {
            result = result.filter(c => c.estado === filterEstado);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.nombre.toLowerCase().includes(term) ||
                c.codigo_curso.toLowerCase().includes(term)
            );
        }
        setFilteredCursos(result);
    };

    const handleSave = async () => {
        // Validar campos obligatorios que la web suele pedir
        if (!nombre || !codigo || !capacidad || !horario) {
            Alert.alert('Incompleto', 'Por favor completa todos los campos obligatorios (*)');
            return;
        }

        if (fechaInicio > fechaFin) {
            Alert.alert('Error en Fechas', 'La fecha de inicio no puede ser posterior a la fecha de fin');
            return;
        }

        // Validación de Duración (Paridad Web)
        const tipoSeleccionado = tiposCursos.find(t => t.id_tipo_curso.toString() === idTipoCurso);
        if (tipoSeleccionado && tipoSeleccionado.duracion_meses) {
            const fechaFinEsperada = new Date(fechaInicio);
            fechaFinEsperada.setMonth(fechaFinEsperada.getMonth() + tipoSeleccionado.duracion_meses);

            const diffTime = Math.abs(fechaFin.getTime() - fechaFinEsperada.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 5) { // Margen de 5 días
                Alert.alert(
                    'Duración Incorrecta',
                    `El curso debe durar ${tipoSeleccionado.duracion_meses} meses. La fecha fin debería ser aprox. ${fechaFinEsperada.toLocaleDateString()}.`
                );
                return;
            }
        }

        try {
            setSaving(true);
            const token = await getToken();
            const method = selectedCurso ? 'PUT' : 'POST';
            const url = selectedCurso
                ? `${API_URL}/cursos/${selectedCurso.id_curso}`
                : `${API_URL}/cursos`;

            const body = {
                id_tipo_curso: parseInt(idTipoCurso),
                nombre,
                codigo_curso: codigo,
                descripcion,
                capacidad_maxima: parseInt(capacidad),
                estado,
                horario,
                // Ajustar formato Fecha YYYY-MM-DD
                fecha_inicio: fechaInicio.toISOString().split('T')[0],
                fecha_fin: fechaFin.toISOString().split('T')[0]
            };

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                await fetchCursos();
                setShowModal(false);
            } else {
                const err = await response.text();
                console.error(err);
                try {
                    const jsonErr = JSON.parse(err);
                    Alert.alert('Error', jsonErr.message || 'No se pudo guardar el curso');
                } catch {
                    Alert.alert('Error', 'No se pudo guardar el curso');
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error de red al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedCurso) return;
        Alert.alert(
            'Eliminar Curso',
            `¿Estás seguro de eliminar el curso "${selectedCurso.nombre}"? Esta acción no se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setSaving(true);
                            const token = await getToken();
                            const response = await fetch(`${API_URL}/cursos/${selectedCurso.id_curso}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (response.ok) {
                                await fetchCursos();
                                setShowModal(false);
                                Alert.alert('Éxito', 'Curso eliminado correctamente');
                            } else {
                                Alert.alert('Error', 'No se pudo eliminar el curso (puede tener estudiantes inscritos)');
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Error de red');
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCursos();
    };

    const onDateChange = (event: any, selectedDate?: Date, type?: 'start' | 'end') => {
        if (type === 'start') {
            setShowPickerInicio(Platform.OS === 'ios');
            if (selectedDate) {
                setFechaInicio(selectedDate);
                // Auto-calcular fecha fin si hay tipo seleccionado
                const tipo = tiposCursos.find(t => t.id_tipo_curso.toString() === idTipoCurso);
                if (tipo && tipo.duracion_meses) {
                    calculateEndDate(selectedDate, tipo.duracion_meses);
                }
            }
        } else {
            setShowPickerFin(Platform.OS === 'ios');
            if (selectedDate) setFechaFin(selectedDate);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'activo': return theme.primary;
            case 'planificado': return theme.warning;
            case 'finalizado': return theme.textMuted;
            case 'cancelado': return theme.danger;
            default: return theme.primary;
        }
    };

    const formatDateDisplay = (date: string) => {
        if (!date) return '-';
        // Evitar desfase de zona horaria al mostrar solo fecha
        const d = new Date(date);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const renderItem = ({ item }: { item: Course }) => {
        const statusColor = getStatusColor(item.estado);
        const capacityPercent = Math.round(((item.capacidad_maxima - (item.cupos_disponibles || 0)) / item.capacidad_maxima) * 100);

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => { setSelectedCurso(item); setShowModal(true); }}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={[styles.codeBadge, { backgroundColor: `${theme.primary}15` }]}>
                                <Text style={[styles.codeText, { color: theme.primary }]}>{item.codigo_curso}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                <Text style={[styles.statusText, { color: statusColor }]}>{item.estado}</Text>
                            </View>
                        </View>
                        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{item.nombre}</Text>
                        <Text style={[styles.horarioText, { color: theme.textSecondary }]}>{(item.horario || 'Horario no definido').toUpperCase()}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.cardFooter}>
                    <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                            {formatDateDisplay(item.fecha_inicio)} - {formatDateDisplay(item.fecha_fin)}
                        </Text>
                    </View>

                    <View style={styles.footerItem}>
                        <View style={{ width: 60, height: 4, backgroundColor: theme.border, borderRadius: 2, marginRight: 6 }}>
                            <View style={{ width: `${capacityPercent}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 2 }} />
                        </View>
                        <Text style={{ fontSize: 10, color: theme.textMuted }}>{capacityPercent}%</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Paginación
    const totalPages = Math.ceil(cursos.length / itemsPerPage);
    const paginatedCursos = cursos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* --- SUMMARY CARD (Clean Nike Effect) --- */}
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Cursos</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona y administra los cursos</Text>

                <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1 }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} style={{ marginLeft: 10 }} />
                    <TextInput
                        placeholder="Buscar curso..."
                        placeholderTextColor={theme.textMuted}
                        style={[styles.searchInput, { color: theme.text }]}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 8 }}>
                            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {['todos', 'activo', 'finalizado', 'cancelado'].map((f) => (
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
            </View>

            {/* --- LISTA --- */}
            <FlatList
                data={paginatedCursos}
                renderItem={renderItem}
                keyExtractor={(item) => item.id_curso.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="library-outline" size={48} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No se encontraron cursos</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={cursos.length}
                        onPageChange={setCurrentPage}
                        theme={theme}
                        itemLabel="cursos"
                    />
                }
            />

            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}

            {/* Floating Action Button - Nuevo Curso */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary }]}
                onPress={() => { setSelectedCurso(null); setShowModal(true); }}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* --- MODAL INLINE COMPLETO --- */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1, justifyContent: 'flex-end' }}
                    >
                        <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>
                                    {selectedCurso ? 'Editar Curso' : 'Nuevo Curso'}
                                </Text>
                                <TouchableOpacity onPress={() => setShowModal(false)}>
                                    <Ionicons name="close" size={24} color={theme.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.modalForm}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Curso *</Text>
                                    <CompactPicker
                                        items={[
                                            { label: "Selecciona un tipo...", value: "" },
                                            ...tiposCursos.map(t => ({ label: t.nombre, value: t.id_tipo_curso.toString() }))
                                        ]}
                                        selectedValue={idTipoCurso}
                                        onValueChange={handleTipoChange}
                                        theme={theme}
                                    />
                                    {(codigo || nombre) ? (
                                        <View style={{ marginTop: 8, padding: 8, backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
                                            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                                <Text style={{ fontWeight: 'bold' }}>Código:</Text> {codigo}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                                                <Text style={{ fontWeight: 'bold' }}>Nombre:</Text> {nombre}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Horario *</Text>
                                        <CompactPicker
                                            items={[
                                                { label: "Matutino", value: "matutino" },
                                                { label: "Vespertino", value: "vespertino" }
                                            ]}
                                            selectedValue={horario}
                                            onValueChange={setHorario}
                                            theme={theme}
                                        />
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Capacidad *</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                            value={capacidad}
                                            onChangeText={setCapacidad}
                                            keyboardType="numeric"
                                            placeholder="Ej: 30"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>Estado</Text>
                                    <CompactPicker
                                        items={[
                                            { label: "Activo", value: "activo" },
                                            { label: "Finalizado", value: "finalizado" },
                                            { label: "Cancelado", value: "cancelado" }
                                        ]}
                                        selectedValue={estado}
                                        onValueChange={setEstado}
                                        theme={theme}
                                    />
                                </View>

                                {/* FECHAS */}
                                <View style={{ flexDirection: 'row', gap: 15, marginBottom: 16 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Inicio *</Text>
                                        <TouchableOpacity
                                            style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, justifyContent: 'center' }]}
                                            onPress={() => setShowPickerInicio(true)}
                                        >
                                            <Text style={{ color: theme.text }}>{fechaInicio.toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                        {showPickerInicio && (
                                            <DateTimePicker
                                                value={fechaInicio}
                                                mode="date"
                                                display="default"
                                                onChange={(e, d) => onDateChange(e, d, 'start')}
                                            />
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: theme.textSecondary }]}>Fin *</Text>
                                        <TouchableOpacity
                                            style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, justifyContent: 'center' }]}
                                            onPress={() => setShowPickerFin(true)}
                                        >
                                            <Text style={{ color: theme.text }}>{fechaFin.toLocaleDateString()}</Text>
                                        </TouchableOpacity>
                                        {showPickerFin && (
                                            <DateTimePicker
                                                value={fechaFin}
                                                mode="date"
                                                display="default"
                                                onChange={(e, d) => onDateChange(e, d, 'end')}
                                            />
                                        )}
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: theme.textSecondary }]}>Descripción</Text>
                                    <TextInput
                                        style={[styles.textArea, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                        value={descripcion}
                                        onChangeText={setDescripcion}
                                        multiline
                                        numberOfLines={4}
                                        placeholder="Detalles del curso..."
                                        placeholderTextColor={theme.textMuted}
                                    />
                                </View>

                            </ScrollView>

                            <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
                                {selectedCurso && (
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: theme.danger + '20' }]}
                                        onPress={handleDelete}
                                    >
                                        <Ionicons name="trash-outline" size={22} color={theme.danger} />
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.cancelButton, { borderColor: theme.border }]}
                                    onPress={() => setShowModal(false)}
                                >
                                    <Text style={{ color: theme.text }}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {saving ? 'Guardando...' : 'Guardar'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    summaryCard: {
        marginBottom: 4,
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, // Menos sombra
        shadowRadius: 8,
        elevation: 3
    },
    headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, marginBottom: 16 },

    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8
    },

    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 44, marginBottom: 20 },
    searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15 },
    filterRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
    filterButton: {
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 90,
        alignItems: 'center'
    },
    filterButtonText: { fontSize: 12.5, textAlign: 'center', fontWeight: '600' },

    listContent: { padding: 20, paddingBottom: 100 },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    codeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    codeText: { fontSize: 11, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    horarioText: { fontSize: 12, marginTop: 4 },
    cardTitle: { fontSize: 16, fontWeight: '700', marginTop: 4, lineHeight: 22 },

    divider: { height: 1, width: '100%', marginBottom: 10 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerText: { fontSize: 11 },

    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { marginTop: 10, fontSize: 15 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalForm: { marginTop: 15 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, marginBottom: 6, fontWeight: '500' },
    input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 15 },
    textArea: { height: 100, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 15, textAlignVertical: 'top' },
    pickerContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', height: 50, justifyContent: 'center' },

    modalFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15, borderTopWidth: 1, gap: 15 },
    cancelButton: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginLeft: 0 },
    saveButton: { flex: 1.5, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    deleteButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginRight: 0 },
});
