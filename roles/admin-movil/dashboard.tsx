import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    StatusBar,
    Platform,
    ActivityIndicator,
    Image // ADDED
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, getUserData, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import NotificationBell from '../../../components/NotificationBell'; // ADDED

const { width } = Dimensions.get('window');

// --- INTERFACES ---
interface AdminStats {
    totalAdministradores: number;
    totalEstudiantes: number;
    estudiantesActivos: number;
    totalDocentes: number;
    cursosActivos: number;
    matriculasAceptadas: number;
    matriculasPendientes: number;
    porcentajeAdministradores: number;
    porcentajeEstudiantes: number;
    porcentajeDocentes: number;
    porcentajeCursos: number;
    porcentajeMatriculasAceptadas: number;
    porcentajeMatriculasPendientes: number;
}

interface EstadisticasEstudiantes {
    estudiantes_activos: number;
    estudiantes_inactivos: number;
    porcentaje_activos: number;
    tasa_retencion: number;
    tasa_aprobacion: number;
    tasa_graduacion: number;
    tasa_ocupacion: number;
}

interface IngresosMes {
    ingresos_mes_actual: number;
    porcentaje_cambio: number;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Estados de Datos (Paridad con Web)
    const [stats, setStats] = useState<AdminStats>({
        totalAdministradores: 0, totalEstudiantes: 0, estudiantesActivos: 0, totalDocentes: 0,
        cursosActivos: 0, matriculasAceptadas: 0, matriculasPendientes: 0,
        porcentajeAdministradores: 0, porcentajeEstudiantes: 0, porcentajeDocentes: 0,
        porcentajeCursos: 0, porcentajeMatriculasAceptadas: 0, porcentajeMatriculasPendientes: 0
    });
    const [matriculasPorMes, setMatriculasPorMes] = useState<any[]>([]);
    const [actividadReciente, setActividadReciente] = useState<any[]>([]);
    const [cursosTop, setCursosTop] = useState<any[]>([]);
    const [ingresosMes, setIngresosMes] = useState<IngresosMes>({ ingresos_mes_actual: 0, porcentaje_cambio: 0 });
    const [estadisticasEstudiantes, setEstadisticasEstudiantes] = useState<EstadisticasEstudiantes>({
        estudiantes_activos: 0, estudiantes_inactivos: 0, porcentaje_activos: 0,
        tasa_retencion: 0, tasa_aprobacion: 0, tasa_graduacion: 0, tasa_ocupacion: 0
    });
    const [pagosPendientes, setPagosPendientes] = useState({ total_pendientes: 0 });
    const [proximosVencimientos, setProximosVencimientos] = useState<any[]>([]);

    // TEMA ADMIN (Rojo/Oscuro)
    const theme = darkMode ? {
        bg: '#0a0a0a',
        cardBg: '#141414',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        border: '#27272a',
        primary: '#ef4444', // Rojo Admin
        primaryGradient: ['#ef4444', '#dc2626'] as const,
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
        purple: '#8b5cf6',
        cardBorder: 'rgba(239, 68, 68, 0.2)'
    } : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        text: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: '#e2e8f0',
        primary: '#ef4444', // Rojo Admin
        primaryGradient: ['#ef4444', '#dc2626'] as const,
        success: '#059669',
        warning: '#d97706',
        info: '#2563eb',
        purple: '#7c3aed',
        cardBorder: 'rgba(239, 68, 68, 0.1)'
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    const loadData = async () => {
        try {
            // setLoading(true); // Evitar flicker excesivo en focus
            const mode = await getDarkMode();
            setDarkMode(mode);
            const user = await getUserData();
            setUserData(user);
            const token = await getToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            // Promise.all para paridad con Web
            const [
                statsRes, matriculasRes, actividadRes, cursosTopRes,
                ingresosRes, estudiantesRes, pagosRes, vencimientosRes
            ] = await Promise.all([
                fetch(`${API_URL}/users/admin-stats`, { headers }),
                fetch(`${API_URL}/dashboard/matriculas-por-mes`, { headers }),
                fetch(`${API_URL}/dashboard/actividad-reciente`, { headers }),
                fetch(`${API_URL}/dashboard/cursos-top-matriculas`, { headers }),
                fetch(`${API_URL}/dashboard/ingresos-mes-actual`, { headers }),
                fetch(`${API_URL}/dashboard/estadisticas-estudiantes`, { headers }),
                fetch(`${API_URL}/dashboard/pagos-pendientes-verificacion`, { headers }),
                fetch(`${API_URL}/dashboard/proximos-vencimientos`, { headers })
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (matriculasRes.ok) setMatriculasPorMes(await matriculasRes.json());
            if (actividadRes.ok) setActividadReciente(await actividadRes.json());
            if (cursosTopRes.ok) setCursosTop(await cursosTopRes.json());
            if (ingresosRes.ok) setIngresosMes(await ingresosRes.json());
            if (estudiantesRes.ok) setEstadisticasEstudiantes(await estudiantesRes.json());
            if (pagosRes.ok) setPagosPendientes(await pagosRes.json());
            if (vencimientosRes.ok) setProximosVencimientos(await vencimientosRes.json());

        } catch (error) {
            console.error('Error loading Admin Dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
    };

    // Componentes de UI
    const renderStatsCard = (title: string, value: string | number, icon: any, color: string, delay: number, subtitle?: string) => (
        <View
            style={[
                styles.statCard,
                {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    shadowColor: darkMode ? "#000" : "#cbd5e1"
                }
            ]}
        >
            <View style={[styles.statHeader]}>
                <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                    <Ionicons name={icon} size={18} color={color} />
                </View>
                {subtitle && <Text style={{ fontSize: 10, color: color, fontWeight: '700' }}>{subtitle}</Text>}
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{loading ? '...' : value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{title}</Text>
        </View>
    );

    const renderActivityItem = (item: any, index: number) => {
        let iconName: any = 'ellipse';
        let color = theme.textMuted;

        // Mapeo simple de iconos según texto/color de API (Paridad Web)
        if (item.icono === 'UserPlus') { iconName = 'person-add'; color = theme.success; }
        else if (item.icono === 'DollarSign') { iconName = 'cash'; color = theme.warning; } // Web usa #f59e0b warning
        else if (item.icono === 'Award') { iconName = 'ribbon'; color = theme.purple; }
        else if (item.icono === 'BookOpen') { iconName = 'book'; color = theme.info; }
        else if (item.icono === 'UserCheck') { iconName = 'checkmark-done-circle'; color = theme.success; }

        return (
            <View key={index} style={[styles.activityItem, { borderBottomColor: theme.border, borderBottomWidth: index === actividadReciente.length - 1 ? 0 : 1 }]}>
                <View style={[styles.activityIconBox, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
                    <Ionicons name={iconName} size={16} color={color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.activityText, { color: theme.text }]}>{item.texto}</Text>
                    <Text style={[styles.activityTime, { color: theme.textMuted }]}>{item.tiempo}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* WELCOME CARD (Red Gradient) */}
                <View style={styles.welcomeCardContainer}>
                    <LinearGradient
                        colors={theme.primaryGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.welcomeCardGradient}
                    >
                        <View>
                            <Text style={styles.welcomeLabel}>Bienvenido,</Text>
                            <Text style={styles.userName}>
                                {userData?.nombre} {userData?.apellido}
                            </Text>
                            <Text style={styles.userRole}>Administrador</Text>
                        </View>

                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.9)" />
                            <Text style={styles.dateText}>
                                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* --- STATS PRINCIPALES --- */}
                <View style={styles.gridContainer}>
                    <View style={styles.row}>
                        {renderStatsCard('Estudiantes Total', stats.totalEstudiantes, 'school', theme.info, 0, `+${stats.porcentajeEstudiantes}%`)}
                        {renderStatsCard('Activos', stats.estudiantesActivos, 'person-circle', theme.success, 100)}
                    </View>
                    <View style={styles.row}>
                        {renderStatsCard('Ingresos Mes', `$${ingresosMes.ingresos_mes_actual.toFixed(2)}`, 'cash', theme.success, 200, `${ingresosMes.porcentaje_cambio >= 0 ? '+' : ''}${ingresosMes.porcentaje_cambio}%`)}
                        {renderStatsCard('Pagos Pendientes', pagosPendientes.total_pendientes, 'time', theme.warning, 300)}
                    </View>
                    <View style={styles.row}>
                        {renderStatsCard('Matrículas Aceptadas', stats.matriculasAceptadas, 'checkmark-circle', theme.purple, 400)}
                        {renderStatsCard('Cursos Activos', stats.cursosActivos, 'library', theme.primary, 500)}
                    </View>
                </View>

                {/* --- TASA DE RETENCIÓN & APROBACIÓN --- */}
                <View style={[styles.sectionContainer, { marginTop: 10 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 20 }]}>Indicadores Académicos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>Tasa Aprobación</Text>
                            <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700', marginTop: 2 }}>{estadisticasEstudiantes.tasa_aprobacion}%</Text>
                            <View style={[styles.miniBarBG, { backgroundColor: `${theme.primary}20`, marginTop: 6 }]}>
                                <View style={[styles.miniBarFill, { width: `${estadisticasEstudiantes.tasa_aprobacion}%`, backgroundColor: theme.primary }]} />
                            </View>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>Tasa Retención</Text>
                            <Text style={{ color: theme.purple, fontSize: 18, fontWeight: '700', marginTop: 2 }}>{estadisticasEstudiantes.tasa_retencion}%</Text>
                            <View style={[styles.miniBarBG, { backgroundColor: `${theme.purple}20`, marginTop: 6 }]}>
                                <View style={[styles.miniBarFill, { width: `${estadisticasEstudiantes.tasa_retencion}%`, backgroundColor: theme.purple }]} />
                            </View>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>Ocupación</Text>
                            <Text style={{ color: theme.info, fontSize: 18, fontWeight: '700', marginTop: 2 }}>{estadisticasEstudiantes.tasa_ocupacion}%</Text>
                            <View style={[styles.miniBarBG, { backgroundColor: `${theme.info}20`, marginTop: 6 }]}>
                                <View style={[styles.miniBarFill, { width: `${estadisticasEstudiantes.tasa_ocupacion}%`, backgroundColor: theme.info }]} />
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* --- PRÓXIMOS VENCIMIENTOS (Faltante) --- */}
                <View style={styles.sectionContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Próximos Vencimientos</Text>
                        {proximosVencimientos.length > 0 &&
                            <View style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                                <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '700' }}>{proximosVencimientos.length} pendientes</Text>
                            </View>
                        }
                    </View>

                    <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20 }]}>
                        {proximosVencimientos.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle-outline" size={30} color={theme.textMuted} />
                                <Text style={{ marginTop: 8, color: theme.textMuted }}>No hay pagos próximos a vencer</Text>
                            </View>
                        ) : (
                            proximosVencimientos.map((item, idx) => {
                                const dias = item.dias_restantes;
                                const urgenciaColor = dias <= 2 ? theme.primary : dias <= 5 ? theme.warning : theme.success;
                                return (
                                    <View key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: idx === proximosVencimientos.length - 1 ? 0 : 1, borderBottomColor: theme.border }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{item.nombre_estudiante}</Text>
                                                <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.nombre_curso} • Cuota #{item.numero_cuota}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>${item.monto}</Text>
                                                <Text style={{ color: urgenciaColor, fontSize: 10, fontWeight: '700' }}>
                                                    {dias === 0 ? 'HOY' : `${dias} días`}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )
                            })
                        )}
                    </View>
                </View>

                {/* --- MATRÍCULAS POR MES (Gráfico Barras) --- */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 20 }]}>Matrículas (Últimos 6 meses)</Text>
                    <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20, padding: 20, borderColor: theme.border, borderWidth: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 10 }}>
                            {matriculasPorMes.length > 0 ? matriculasPorMes.map((m, i) => (
                                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                                    <View style={{
                                        height: m.valor === 0 ? 5 : `${(m.valor / (Math.max(...matriculasPorMes.map(x => x.valor)) || 1)) * 100}%`,
                                        width: '100%',
                                        backgroundColor: theme.primary,
                                        borderRadius: 4,
                                        opacity: 0.8
                                    }} />
                                    <Text style={{ marginTop: 6, fontSize: 10, color: theme.textSecondary }}>{m.mes.substring(0, 3)}</Text>
                                </View>
                            )) : (
                                <Text style={{ color: theme.textMuted }}>No hay datos de historial</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* --- CURSOS TOP --- */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 20 }]}>Top Cursos</Text>
                    <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20 }]}>
                        {cursosTop.length === 0 ? (
                            <Text style={{ padding: 20, textAlign: 'center', color: theme.textMuted }}>Sin datos</Text>
                        ) : (
                            cursosTop.map((curso, idx) => (
                                <View key={idx} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{curso.nombre_curso}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{curso.total_matriculas} Est.</Text>
                                    </View>
                                    <View style={{ height: 6, backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 3 }}>
                                        <View style={{ height: '100%', borderRadius: 3, backgroundColor: curso.color, width: `${(curso.total_matriculas / (cursosTop[0]?.total_matriculas || 1)) * 100}%` }} />
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>

                {/* --- ACTIVIDAD RECIENTE --- */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 20 }]}>Actividad Reciente</Text>
                    <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20, paddingVertical: 8, borderColor: theme.border, borderWidth: 1 }]}>
                        {actividadReciente.length === 0 ? (
                            <Text style={{ padding: 20, textAlign: 'center', color: theme.textMuted }}>No hay actividad reciente</Text>
                        ) : (
                            actividadReciente.map((item, idx) => renderActivityItem(item, idx))
                        )}
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    // WELCOME CARD REFACTOR
    welcomeCardContainer: {
        marginBottom: 20,
    },
    welcomeCardGradient: {
        paddingTop: 25,
        paddingBottom: 25,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        justifyContent: 'space-between',
        height: 180, // Allow space for info
    },
    welcomeLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', marginBottom: 4 },
    userName: { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
    userRole: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },

    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', gap: 6 },
    dateText: { color: 'rgba(255,255,255,0.95)', fontSize: 12, textTransform: 'capitalize' },

    gridContainer: { paddingHorizontal: 20, marginTop: -30 }, // Overlap card
    row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    statCard: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    iconContainer: { padding: 6, borderRadius: 8 },
    statValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 11, fontWeight: '500' },

    sectionContainer: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

    kpiCard: { width: 105, height: 85, padding: 10, borderRadius: 12, borderWidth: 1, marginRight: 0, justifyContent: 'space-between' },
    miniBarBG: { height: 3, width: '100%', borderRadius: 1.5, marginTop: 6 },
    miniBarFill: { height: '100%', borderRadius: 2 },

    cardList: { borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },

    activityItem: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
    activityIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    activityText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
    activityTime: { fontSize: 11, marginTop: 2 }
});
