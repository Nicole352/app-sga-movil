import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Alert,
    Modal,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, getUserData, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';


// function to get theme based on dark mode
const getTheme = (isDark: boolean) => ({
    primary: '#3b82f6',
    secondary: '#2563eb',
    accent: '#f59e0b',
    background: isDark ? '#0a0a0a' : '#f8fafc',
    cardBg: isDark ? '#141414' : '#ffffff',
    text: isDark ? '#ffffff' : '#1e293b',
    textSecondary: isDark ? '#a1a1aa' : '#475569', // Added this line
    textMuted: isDark ? '#71717a' : '#64748b',
    border: isDark ? '#27272a' : '#e2e8f0',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    primaryGradient: ['#3b82f6', '#2563eb'] as const,
    inputBg: isDark ? '#141414' : '#f1f5f9',
});

const theme = getTheme(false);



// --- Tipos ---
interface Curso {
    id_curso: number;
    codigo: string;
    nombre: string;
}

interface Estudiante {
    id_estudiante: number;
    cedula: string;
    nombre: string;
    apellido: string;
}

interface RegistroAsistencia {
    estado: 'presente' | 'ausente' | 'tardanza' | 'justificado';
    observaciones?: string;
    tiene_documento?: boolean;
    documento_nombre?: string;
    documento_uri?: string; // Para nuevos archivos
    documento_file?: any;   // Objeto del archivo seleccionado
}

// --- Componente Picker Compacto (Reutilizable) ---
interface PickerItem {
    label: string;
    value: string;
}

const CompactPicker = ({
    items,
    selectedValue,
    onValueChange,
    placeholder,
    theme
}: {
    items: PickerItem[],
    selectedValue: string,
    onValueChange: (val: string) => void,
    placeholder?: string,
    theme: any
}) => {
    const [showModal, setShowModal] = useState(false);

    const selectedLabel = items.find(i => i.value === selectedValue)?.label || placeholder || items[0]?.label;

    // UI Trigger (Shared)
    const trigger = (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowModal(true)}
            style={[styles.pickerTrigger, {
                backgroundColor: theme.cardBg,
                borderColor: theme.border
            }]}
        >
            <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 }}>
                    {placeholder || 'Seleccionar'}
                </Text>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                    {selectedLabel}
                </Text>
            </View>
            <View style={[styles.pickerIcon, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="chevron-down" size={16} color={theme.primary} />
            </View>
        </TouchableOpacity>
    );

    if (Platform.OS === 'android') {
        return (
            <>
                {trigger}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showModal}
                    onRequestClose={() => setShowModal(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setShowModal(false)}
                        style={styles.modalOverlay}
                    >
                        <Animated.View
                            entering={FadeInDown.duration(300)}
                            style={[styles.modalContent, { backgroundColor: theme.cardBg }]}
                        >
                            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />

                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={[styles.modalTitle, { color: theme.text }]}>Seleccionar Opción</Text>
                                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>Elige una de las opciones de la lista</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                                {items.map((item, index) => {
                                    const isSelected = item.value === selectedValue;
                                    return (
                                        <TouchableOpacity
                                            key={item.value}
                                            onPress={() => {
                                                onValueChange(item.value);
                                                setShowModal(false);
                                            }}
                                            style={[
                                                styles.optionItem,
                                                { borderBottomColor: theme.border + '50' },
                                                isSelected && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                                            ]}
                                        >
                                            <View style={styles.optionInfo}>
                                                <Text style={[
                                                    styles.optionText,
                                                    { color: isSelected ? theme.primary : theme.text },
                                                    isSelected && { fontWeight: '700' }
                                                ]}>
                                                    {item.label}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
            </>
        );
    }

    // IOS: WHEEL
    return (
        <>
            {trigger}
            <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Listo</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue) => onValueChange(itemValue as string)}
                            style={{ height: 200 }}
                            itemStyle={{ color: theme.text, fontSize: 18 }}
                        >
                            {items.map((item) => (
                                <Picker.Item key={item.value} label={item.label} value={item.value} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </>
    );
};


// --- Pantalla Principal ---
export default function TomarAsistenciaScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [cursoSeleccionado, setCursoSeleccionado] = useState<string>('');
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [fecha, setFecha] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [asistencias, setAsistencias] = useState<Map<number, RegistroAsistencia>>(new Map());
    const [darkMode, setDarkMode] = useState(false);

    // Cargar Docente, Cursos y Tema
    useEffect(() => {
        loadTheme();
        loadCursos();

        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);

        return () => {
            eventEmitter.off('themeChanged', themeHandler);
        };
    }, []);

    const loadTheme = async () => {
        const isDark = await getDarkMode();
        setDarkMode(isDark);
    };

    const theme = getTheme(darkMode);




    const loadCursos = async () => {
        try {
            const token = await getToken();
            if (!token) {
                Alert.alert("Error", "No has iniciado sesión");
                return;
            }

            // Usar endpoint correcto para cursos del docente
            const response = await fetch(`${API_URL}/docentes/mis-cursos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    // Mapear respuesta al formato requerido
                    const cursosMapeados = data.map((c: any) => ({
                        id_curso: c.id_curso,
                        codigo: c.codigo_curso,
                        nombre: c.nombre_curso || c.nombre // Ajustar según respuesta real
                    }));
                    setCursos(cursosMapeados);
                }
            } else {
                console.error("Error fetching courses", response.status);
            }
        } catch (error) {
            console.error("Error loading courses:", error);
            Alert.alert("Error", "No se pudieron cargar los cursos");
        }
    };

    // Cargar Estudiantes al seleccionar curso
    const loadEstudiantes = async (codigoCurso: string) => {
        setLoading(true);
        setEstudiantes([]);
        setAsistencias(new Map());

        try {
            const token = await getToken();
            const cursoObj = cursos.find(c => c.codigo === codigoCurso);
            if (!cursoObj) { setLoading(false); return; }

            const res = await fetch(`${API_URL}/asistencias/estudiantes/${cursoObj.id_curso}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.estudiantes) {
                setEstudiantes(data.estudiantes);
                // Inicializar asistencia existente
                loadAsistenciaExistente(cursoObj.id_curso, fecha);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar los estudiantes");
        } finally {
            setLoading(false);
        }
    };

    // Cargar Asistencia Existente
    const loadAsistenciaExistente = async (idCurso: number, date: Date) => {
        try {
            const token = await getToken();
            const dateStr = date.toISOString().split('T')[0];
            const res = await fetch(`${API_URL}/asistencias/curso/${idCurso}/fecha/${dateStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const map = new Map();
                if (data.asistencias) {
                    data.asistencias.forEach((a: any) => {
                        map.set(a.id_estudiante, {
                            estado: a.estado,
                            observaciones: a.observaciones,
                            tiene_documento: a.tiene_documento === 1,
                            documento_nombre: a.documento_nombre_original
                        });
                    });
                    setAsistencias(map);
                }
            }
        } catch (e) { console.error("Error loading existing attendance", e); }
    };

    const handleCursoChange = (codigo: string) => {
        setCursoSeleccionado(codigo);
        if (codigo) loadEstudiantes(codigo);
    };

    const handleFechaChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setFecha(selectedDate);
            if (cursoSeleccionado) {
                const cursoObj = cursos.find(c => c.codigo === cursoSeleccionado);
                if (cursoObj) loadAsistenciaExistente(cursoObj.id_curso, selectedDate);
            }
        }
    };

    const toggleEstado = (idEstudiante: number, estado: 'presente' | 'ausente' | 'tardanza' | 'justificado') => {
        setAsistencias(prev => {
            const next = new Map(prev);
            const current = next.get(idEstudiante) || { estado: 'ausente' }; // Default state logic

            // Logica Justificado Documento
            if (estado === 'justificado') {
                // Document Picker logic moved
                pickDocument(idEstudiante);
            }

            next.set(idEstudiante, { ...current, estado });
            return next;
        });
    };

    const pickDocument = async (idEstudiante: number) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({});
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setAsistencias(prev => {
                    const next = new Map(prev);
                    const current = next.get(idEstudiante) || { estado: 'justificado' };
                    next.set(idEstudiante, {
                        ...current,
                        estado: 'justificado',
                        tiene_documento: true,
                        documento_nombre: file.name,
                        documento_uri: file.uri,
                        documento_file: file
                    });
                    return next;
                });
                Alert.alert("Documento Adjuntado", `Se adjuntó: ${file.name}`);
            }
        } catch (err) {
            console.log("Picking cancelled or failed", err);
        }
    };

    const guardarAsistencia = async () => {
        if (!cursoSeleccionado) return Alert.alert("Error", "Seleccione un curso");

        // Validar que todos los estudiantes tengan estado
        const estudiantesSinEstado = estudiantes.filter(est => !asistencias.has(est.id_estudiante));
        if (estudiantesSinEstado.length > 0) {
            Alert.alert(
                "Incompleto",
                `Falta registrar la asistencia de ${estudiantesSinEstado.length} estudiantes.\n\nPor favor marque a todos antes de guardar.`
            );
            return;
        }

        const cursoObj = cursos.find(c => c.codigo === cursoSeleccionado);
        if (!cursoObj) return;

        setLoading(true);
        try {
            const token = await getToken();
            const userData = await getUserData();

            if (!userData?.id_docente) {
                // Try to get id_docente if not in local storage (fallback)
                // In real app user_data should have it.
                console.warn("No id_docente found in user data");
            }

            const formData = new FormData();
            const asistenciasArray = Array.from(asistencias.entries()).map(([id, data]) => ({
                id_estudiante: id,
                estado: data.estado,
                observaciones: data.observaciones,
                tiene_documento: data.tiene_documento
            }));

            const payload = {
                id_curso: cursoObj.id_curso,
                id_docente: userData?.id_docente || 1, // Fallback safe ID if needed, but should be real
                fecha: fecha.toISOString().split('T')[0],
                asistencias: asistenciasArray
            };

            formData.append('data', JSON.stringify(payload));

            // Append files
            asistencias.forEach((data, id) => {
                if (data.documento_file && data.documento_uri) {
                    // React Native FormData file append
                    const fileConfig: any = {
                        uri: data.documento_uri,
                        name: data.documento_file.name,
                        type: data.documento_file.mimeType || 'application/pdf'
                    };
                    formData.append(`documento_${id}`, fileConfig);
                }
            });

            const res = await fetch(`${API_URL}/asistencias`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 'Content-Type': 'multipart/form-data' // let fetch handle boundary
                }
            });

            if (res.ok) {
                Alert.alert("Éxito", "Asistencia guardada correctamente");
            } else {
                const err = await res.json();
                Alert.alert("Error", err.error || "No se pudo guardar");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Fallo de conexión");
        } finally {
            setLoading(false);
        }
    };



    const renderEstadoButton = (est: Estudiante, label: string, value: 'presente' | 'ausente' | 'tardanza' | 'justificado', color: string) => {
        const isSelected = asistencias.get(est.id_estudiante)?.estado === value;
        return (
            <TouchableOpacity
                onPress={() => toggleEstado(est.id_estudiante, value)}
                style={[
                    styles.statusButton,
                    isSelected && { backgroundColor: color, borderColor: color }
                ]}
            >
                <Text style={[styles.statusText, isSelected && { color: '#fff', fontWeight: 'bold' }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />



            {/* Header Premium */}
            <Animated.View entering={FadeInDown.duration(400)}>
                {/* Header Premium - Clean Nike */}
                <Animated.View entering={FadeInDown.duration(400)}>
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
                        <View style={styles.headerContent}>
                            <View style={{ flexDirection: 'column', gap: 4 }}>
                                <Text style={[styles.headerTitle, { color: theme.text }]}>Tomar Asistencia</Text>
                                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Registra la asistencia diaria</Text>
                            </View>
                            <Ionicons name="calendar" size={28} color={theme.primary} />
                        </View>
                    </View>
                </Animated.View>

            </Animated.View>

            <View style={styles.content}>
                {/* Filtros */}
                <View style={[styles.filtersCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>

                    <Text style={[styles.label, { color: theme.textMuted }]}>Seleccionar Curso:</Text>
                    <CompactPicker
                        items={[
                            { label: "Seleccione un curso...", value: "" },
                            ...cursos.map(c => ({ label: `${c.codigo} - ${c.nombre}`, value: c.codigo }))
                        ]}
                        selectedValue={cursoSeleccionado}
                        onValueChange={handleCursoChange}
                        placeholder="Seleccione un curso"
                        theme={theme}
                    />

                    <View style={{ marginTop: 12 }}>
                        <Text style={[styles.label, { color: theme.textMuted }]}>Fecha:</Text>
                        <TouchableOpacity
                            style={[styles.dateSelector, { backgroundColor: theme.inputBg }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={theme.text} />
                            <Text style={[styles.dateText, { color: theme.text }]}>
                                {fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>


                {/* Stats Cards */}
                {estudiantes.length > 0 && (
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={[styles.statIconContainer, { backgroundColor: theme.success + '15' }]}>
                                <Text style={[styles.statValue, { color: theme.success }]}>
                                    {Array.from(asistencias.values()).filter(a => a.estado === 'presente').length}
                                </Text>
                            </View>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Presente</Text>
                        </View>

                        <View style={[styles.statCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={[styles.statIconContainer, { backgroundColor: theme.error + '15' }]}>
                                <Text style={[styles.statValue, { color: theme.error }]}>
                                    {Array.from(asistencias.values()).filter(a => a.estado === 'ausente').length}
                                </Text>
                            </View>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Ausente</Text>
                        </View>

                        <View style={[styles.statCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={[styles.statIconContainer, { backgroundColor: theme.warning + '15' }]}>
                                <Text style={[styles.statValue, { color: theme.warning }]}>
                                    {Array.from(asistencias.values()).filter(a => a.estado === 'tardanza').length}
                                </Text>
                            </View>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Tardanza</Text>
                        </View>

                        <View style={[styles.statCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                            <View style={[styles.statIconContainer, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.statValue, { color: theme.primary }]}>
                                    {Array.from(asistencias.values()).filter(a => a.estado === 'justificado').length}
                                </Text>
                            </View>
                            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Justif.</Text>
                        </View>
                    </View>
                )}

                {showDatePicker && (
                    <DateTimePicker
                        value={fecha}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={handleFechaChange}
                    />
                )}

                {/* Lista Estudiantes */}
                <ScrollView style={styles.listContainer}>
                    {loading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                    ) : estudiantes.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                                {cursoSeleccionado ? "No hay estudiantes en este curso" : "Seleccione un curso para ver estudiantes"}
                            </Text>
                        </View>
                    ) : (
                        estudiantes.map((est) => (
                            <View key={est.id_estudiante} style={[styles.studentCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                <View style={styles.studentInfo}>
                                    <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[styles.avatarText, { color: theme.primary }]}>{est.nombre.charAt(0)}{est.apellido.charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{est.apellido} {est.nombre}</Text>
                                        <Text style={[styles.studentId, { color: theme.textMuted }]}>{est.cedula}</Text>
                                    </View>
                                    {asistencias.get(est.id_estudiante)?.tiene_documento && (
                                        <Ionicons name="attach" size={20} color={theme.primary} />
                                    )}
                                </View>

                                <View style={styles.actionsRow}>
                                    {renderEstadoButton(est, 'P', 'presente', theme.success)}
                                    {renderEstadoButton(est, 'A', 'ausente', theme.error)}
                                    {renderEstadoButton(est, 'T', 'tardanza', theme.warning)}
                                    {renderEstadoButton(est, 'J', 'justificado', theme.primary)}
                                </View>
                            </View>
                        ))
                    )}
                    <View style={{ height: 20 }} />

                    {/* Footer Actions moved inside ScrollView */}
                    <TouchableOpacity style={styles.saveButton} onPress={guardarAsistencia}>
                        <Ionicons name="save-outline" size={20} color="#fff" />
                        <Text style={styles.saveText}>Guardar Asistencia</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        paddingTop: 10,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
        display: 'none',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    filtersCard: {
        backgroundColor: theme.cardBg,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.border,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.textMuted,
        marginBottom: 4,
    },
    pickerTrigger: {
        borderRadius: 12,
        borderWidth: 1.5,
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 8,
    },
    pickerIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '80%',
    },
    modalIndicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 20,
        opacity: 0.3,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    modalCloseBtn: {
        padding: 4,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderRadius: 12,
        marginBottom: 4,
    },
    optionInfo: {
        flex: 1,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 8,
    },
    dateText: {
        fontSize: 14,
        color: theme.text,
        textTransform: 'capitalize',
    },
    listContainer: {
        flex: 1,
    },
    studentCard: {
        backgroundColor: theme.cardBg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statCardContainer: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: theme.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    studentName: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.text,
    },
    studentId: {
        fontSize: 12,
        color: theme.textMuted,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    statusButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 12,
        color: theme.textMuted,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        color: theme.textMuted,
        marginTop: 10,
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: theme.primary,
        borderRadius: 12,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10,
        marginBottom: 20,
    },
    saveText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});
