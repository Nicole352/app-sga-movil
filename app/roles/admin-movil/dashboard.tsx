import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    StyleSheet,
    Dimensions,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Line, Polygon, Polyline, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { API_URL } from '../../../constants/config';
import { getToken, getUserData, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import CompactPicker from './components/CompactPicker';

const { width } = Dimensions.get('window');

// --- INTERFACES ---
interface AdminStats {
    totalAdministradores: number;
    totalEstudiantes: number;
    estudiantesActivos: number;
    totalDocentes: number;
    cursosActivos: number;
    matriculasAceptadas: number;
    porcentajeAdministradores: number;
    porcentajeEstudiantes: number;
    porcentajeDocentes: number;
    porcentajeCursos: number;
    porcentajeMatriculasAceptadas: number;
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

interface IngresosTendencias {
    datos: Array<{ mes: string; valor: number }>;
    promedio: number;
    total: number;
    mes_mayor: { mes: string; valor: number };
}

export default function AdminDashboard() {
    const [darkMode, setDarkMode] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Estados de Datos
    const [stats, setStats] = useState<AdminStats>({
        totalAdministradores: 0, totalEstudiantes: 0, estudiantesActivos: 0, totalDocentes: 0,
        cursosActivos: 0, matriculasAceptadas: 0,
        porcentajeAdministradores: 0, porcentajeEstudiantes: 0, porcentajeDocentes: 0,
        porcentajeCursos: 0, porcentajeMatriculasAceptadas: 0
    });
    const [ingresosMes, setIngresosMes] = useState<IngresosMes>({ ingresos_mes_actual: 0, porcentaje_cambio: 0 });
    const [estadisticasEstudiantes, setEstadisticasEstudiantes] = useState<EstadisticasEstudiantes>({
        estudiantes_activos: 0, estudiantes_inactivos: 0, porcentaje_activos: 0,
        tasa_retencion: 0, tasa_aprobacion: 0, tasa_graduacion: 0, tasa_ocupacion: 0
    });
    const [pagosPendientes, setPagosPendientes] = useState({ total_pendientes: 0 });
    const [proximosVencimientos, setProximosVencimientos] = useState<any[]>([]);
    const [periodFilter, setPeriodFilter] = useState('month');
    const [courseFilter, setCourseFilter] = useState('all');
    const [tiposCursos, setTiposCursos] = useState<Array<{ id_tipo_curso: number; nombre: string }>>([]);
    const [ingresosTendencias, setIngresosTendencias] = useState<IngresosTendencias>({
        datos: [], promedio: 0, total: 0, mes_mayor: { mes: '', valor: 0 }
    });

    // TEMA ADMIN (Rojo/Oscuro)
    const theme = darkMode ? {
        bg: '#0a0a0a',
        cardBg: '#141414',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        border: '#27272a',
        primary: '#ef4444',
        accent: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
        purple: '#8b5cf6',
        inputBg: '#1a1a1a'
    } : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        text: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: '#e2e8f0',
        primary: '#ef4444',
        accent: '#ef4444',
        success: '#059669',
        warning: '#d97706',
        info: '#2563eb',
        purple: '#7c3aed',
        inputBg: '#f1f5f9'
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

    // Recargar datos cuando cambien los filtros
    useEffect(() => {
        loadData();
    }, [periodFilter, courseFilter]);

    const loadData = async () => {
        try {
            const mode = await getDarkMode();
            setDarkMode(mode);
            const user = await getUserData();
            setUserData(user);
            const token = await getToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            const [
                statsRes, ingresosRes, estudiantesRes, pagosRes,
                vencimientosRes, tendenciasRes, tiposCursosRes
            ] = await Promise.all([
                fetch(`${API_URL}/users/admin-stats?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/dashboard/ingresos-mes-actual?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/dashboard/estadisticas-estudiantes?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/dashboard/pagos-pendientes-verificacion?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/dashboard/proximos-vencimientos?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/dashboard/ingresos-tendencias?period=${periodFilter}&course=${courseFilter}`, { headers }),
                fetch(`${API_URL}/tipos-cursos`, { headers })
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (ingresosRes.ok) setIngresosMes(await ingresosRes.json());
            if (estudiantesRes.ok) setEstadisticasEstudiantes(await estudiantesRes.json());
            if (pagosRes.ok) setPagosPendientes(await pagosRes.json());
            if (vencimientosRes.ok) setProximosVencimientos(await vencimientosRes.json());
            if (tendenciasRes.ok) setIngresosTendencias(await tendenciasRes.json());
            if (tiposCursosRes.ok) setTiposCursos(await tiposCursosRes.json());

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

    const getPeriodLabel = () => {
        switch (periodFilter) {
            case 'today': return 'de Hoy';
            case 'week': return 'de los Últimos 7 Días';
            case 'month': return 'del Mes';
            case 'year': return 'del Año';
            case 'all': return 'Total';
            default: return 'del Mes';
        }
    };

    // Componentes de UI
    const renderStatsCard = (title: string, value: string | number, icon: any, color: string, subtitle?: string) => (
        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.statHeader}>
                <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                    <Ionicons name={icon} size={16} color={color} />
                </View>
                {subtitle && <Text style={{ fontSize: 10, color: color, fontWeight: '700' }}>{subtitle}</Text>}
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{loading ? '...' : value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{title}</Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
            >
                {/* WELCOME CARD */}
                <View style={styles.welcomeCardContainer}>
                    <View style={[styles.welcomeCardContent, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
                        <View>
                            <Text style={[styles.welcomeLabel, { color: theme.textSecondary }]}>Bienvenido,</Text>
                            <Text style={[styles.userName, { color: theme.text }]}>
                                {userData?.nombre} {userData?.apellido}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={[styles.userRole, { color: theme.primary, fontWeight: '700' }]}>ADMINISTRATIVO</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                            <Text style={[styles.dateText, { color: theme.textMuted }]}>
                                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* FILTROS */}
                <View style={[styles.filtersContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <CompactPicker
                        items={[
                            { label: 'Hoy', value: 'today' },
                            { label: 'Últimos 7 días', value: 'week' },
                            { label: 'Este mes', value: 'month' },
                            { label: 'Este año', value: 'year' },
                            { label: 'Todo', value: 'all' }
                        ]}
                        selectedValue={periodFilter}
                        onValueChange={setPeriodFilter}
                        placeholder="Período"
                        theme={theme}
                    />
                    <CompactPicker
                        items={[
                            { label: 'Todos', value: 'all' },
                            ...tiposCursos.map(tc => ({ label: tc.nombre, value: tc.id_tipo_curso.toString() }))
                        ]}
                        selectedValue={courseFilter}
                        onValueChange={setCourseFilter}
                        placeholder="Curso"
                        theme={theme}
                    />
                </View>

                {/* STATS PRINCIPALES (6 cards en grid 2x3) */}
                <View style={styles.gridContainer}>
                    <View style={styles.row}>
                        {renderStatsCard('Total Administradores', stats.totalAdministradores, 'shield', theme.primary, `+${stats.porcentajeAdministradores}%`)}
                        {renderStatsCard('Cursos Activos', stats.cursosActivos, 'library', theme.success, `+${stats.porcentajeCursos}%`)}
                    </View>
                    <View style={styles.row}>
                        {renderStatsCard('Total Estudiantes', stats.totalEstudiantes, 'school', theme.info, `+${stats.porcentajeEstudiantes}%`)}
                        {renderStatsCard('Estudiantes Activos', stats.estudiantesActivos, 'person-circle', theme.success)}
                    </View>
                    <View style={styles.row}>
                        {renderStatsCard('Total Docentes', stats.totalDocentes, 'people', theme.warning, `+${stats.porcentajeDocentes}%`)}
                        {renderStatsCard('Matrículas Aceptadas', stats.matriculasAceptadas, 'checkmark-circle', theme.purple, `+${stats.porcentajeMatriculasAceptadas}%`)}
                    </View>
                </View>

                {/* TASAS (3 cards horizontales) */}
                <View style={styles.sectionContainer}>
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
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>Tasa Graduación</Text>
                            <Text style={{ color: theme.purple, fontSize: 18, fontWeight: '700', marginTop: 2 }}>{estadisticasEstudiantes.tasa_graduacion}%</Text>
                            <View style={[styles.miniBarBG, { backgroundColor: `${theme.purple}20`, marginTop: 6 }]}>
                                <View style={[styles.miniBarFill, { width: `${estadisticasEstudiantes.tasa_graduacion}%`, backgroundColor: theme.purple }]} />
                            </View>
                        </View>
                        <View style={[styles.kpiCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
                            <Text style={{ color: theme.textMuted, fontSize: 11 }}>Ocupación Cursos</Text>
                            <Text style={{ color: theme.info, fontSize: 18, fontWeight: '700', marginTop: 2 }}>{estadisticasEstudiantes.tasa_ocupacion}%</Text>
                            <View style={[styles.miniBarBG, { backgroundColor: `${theme.info}20`, marginTop: 6 }]}>
                                <View style={[styles.miniBarFill, { width: `${estadisticasEstudiantes.tasa_ocupacion}%`, backgroundColor: theme.info }]} />
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* MÉTRICAS (3 cards) */}
                <View style={[styles.gridContainer, { marginTop: 10 }]}>
                    {/* Ingresos */}
                    <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: `${theme.success}50`, borderWidth: 1.5 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Ionicons name="cash" size={14} color={theme.success} />
                            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>Ingresos {getPeriodLabel()}</Text>
                        </View>
                        <Text style={{ color: theme.success, fontSize: 20, fontWeight: '700' }}>
                            ${(ingresosTendencias?.total || 0).toFixed(2)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Ionicons name="trending-up" size={10} color={ingresosMes.porcentaje_cambio >= 0 ? theme.success : theme.primary} />
                            <Text style={{ color: ingresosMes.porcentaje_cambio >= 0 ? theme.success : theme.primary, fontSize: 10, fontWeight: '700' }}>
                                {ingresosMes.porcentaje_cambio >= 0 ? '+' : ''}{ingresosMes.porcentaje_cambio}%
                            </Text>
                        </View>
                    </View>

                    {/* Estudiantes Activos */}
                    <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: `${theme.info}50`, borderWidth: 1.5 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Ionicons name="people" size={14} color={theme.info} />
                            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>Estudiantes Activos</Text>
                        </View>
                        <Text style={{ color: theme.info, fontSize: 20, fontWeight: '700' }}>
                            {estadisticasEstudiantes.porcentaje_activos}%
                        </Text>
                        <View style={{ height: 4, backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 2, marginTop: 6 }}>
                            <View style={{ height: '100%', borderRadius: 2, backgroundColor: theme.info, width: `${estadisticasEstudiantes.porcentaje_activos}%` }} />
                        </View>
                        <Text style={{ color: theme.textMuted, fontSize: 9, marginTop: 4 }}>
                            {estadisticasEstudiantes.estudiantes_activos} de {estadisticasEstudiantes.estudiantes_activos + estadisticasEstudiantes.estudiantes_inactivos}
                        </Text>
                    </View>

                    {/* Tasa Retención */}
                    <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: `${theme.purple}50`, borderWidth: 1.5 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Ionicons name="ribbon" size={14} color={theme.purple} />
                            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>Tasa de Retención</Text>
                        </View>
                        <Text style={{ color: theme.purple, fontSize: 20, fontWeight: '700' }}>
                            {estadisticasEstudiantes.tasa_retencion}%
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 9, marginTop: 4 }}>Estudiantes que completan</Text>
                    </View>
                </View>

                {/* SECCIÓN: Pagos Pendientes + Tendencias + Próximos Vencimientos */}
                <View style={{ marginTop: 16 }}>
                    {/* Pagos Pendientes */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.text, paddingHorizontal: 20 }]}>
                            Pagos Pendientes Verificación {getPeriodLabel()}
                        </Text>
                        <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20, padding: 20, alignItems: 'center', borderColor: theme.border, borderWidth: 1 }]}>
                            <View style={{ width: 120, height: 120, marginBottom: 16, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{
                                    position: 'absolute', width: 120, height: 120, borderRadius: 60,
                                    borderWidth: 14, borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                                }} />
                                <View style={{
                                    position: 'absolute', width: 120, height: 120, borderRadius: 60,
                                    borderWidth: 14, borderColor: theme.warning,
                                    borderTopColor: 'transparent', borderRightColor: 'transparent',
                                    transform: [{ rotate: '-90deg' }]
                                }} />
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ color: theme.warning, fontSize: 32, fontWeight: '700' }}>
                                        {loading ? '...' : pagosPendientes.total_pendientes}
                                    </Text>
                                    <Text style={{ color: theme.textMuted, fontSize: 11 }}>pagos</Text>
                                </View>
                            </View>
                            <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center' }}>
                                Esperando aprobación del admin
                            </Text>
                        </View>
                    </View>

                    {/* TENDENCIAS (NUEVO - matching web) */}
                    <View style={styles.sectionContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 8 }}>
                            <Ionicons name="trending-up" size={16} color={theme.success} />
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                                Tendencias {getPeriodLabel()}
                            </Text>
                        </View>
                        <View style={[styles.cardList, { backgroundColor: theme.cardBg, marginHorizontal: 20, padding: 16, borderColor: theme.border, borderWidth: 1 }]}>
                            {/* Gráfico de líneas SVG */}
                            <View style={{ height: 120, marginBottom: 12 }}>
                                <Svg width="100%" height="120" viewBox="0 0 300 100" preserveAspectRatio="none">
                                    {/* Grid lines */}
                                    {[0, 1, 2, 3].map(i => (
                                        <Line key={i} x1="0" y1={i * 25} x2="300" y2={i * 25} stroke={darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="1" />
                                    ))}

                                    {ingresosTendencias.datos.length > 0 && (() => {
                                        const maxValor = Math.max(...ingresosTendencias.datos.map(d => d.valor), 1);
                                        const points = ingresosTendencias.datos.map((d, i) => {
                                            const x = (i / (ingresosTendencias.datos.length - 1)) * 300;
                                            const y = 100 - ((d.valor / maxValor) * 80);
                                            return `${x},${y}`;
                                        }).join(' ');

                                        return (
                                            <G>
                                                <Defs>
                                                    <LinearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                                        <Stop offset="0%" stopColor="#22c55e" />
                                                        <Stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                                                    </LinearGradient>
                                                </Defs>
                                                <Polygon points={`0,100 ${points} 300,100`} fill="url(#greenGradient)" opacity="0.2" />
                                                <Polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                {ingresosTendencias.datos.map((d, i) => {
                                                    const x = (i / (ingresosTendencias.datos.length - 1)) * 300;
                                                    const y = 100 - ((d.valor / maxValor) * 80);
                                                    const isMax = d.mes === ingresosTendencias.mes_mayor.mes;
                                                    return (
                                                        <Circle key={i} cx={x} cy={y} r={isMax ? 4 : 2.5} fill={isMax ? "#22c55e" : theme.cardBg} stroke="#22c55e" strokeWidth="1.5" />
                                                    );
                                                })}
                                            </G>
                                        );
                                    })()}
                                </Svg>
                            </View>

                            {/* Stats */}
                            <View style={{ gap: 8 }}>
                                <View style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(34,197,94,0.06)', borderRadius: 8, padding: 10 }}>
                                    <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>Total</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.success }}>
                                        ${(ingresosTendencias?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: darkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)', borderRadius: 8, padding: 10 }}>
                                    <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>Mejor</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.success }}>
                                        {loading ? '...' : ingresosTendencias.mes_mayor.mes}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Próximos Vencimientos */}
                    <View style={styles.sectionContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 12 }}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Próximos Vencimientos (7 días)</Text>
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
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    welcomeCardContainer: {
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
        zIndex: 10,
    },
    welcomeCardContent: {
        paddingTop: 10,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        justifyContent: 'space-between',
        height: 145,
        borderBottomWidth: 1,
        zIndex: 1
    },
    welcomeLabel: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
    userName: { fontSize: 20, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    userRole: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', gap: 6, opacity: 0.8 },
    dateText: { fontSize: 12, textTransform: 'capitalize', fontWeight: '500' },

    filtersContainer: {
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 0
    },

    gridContainer: { paddingHorizontal: 20, marginTop: 0, zIndex: 20 },
    row: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    statCard: { flex: 1, padding: 8, borderRadius: 12, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
    iconContainer: { padding: 5, borderRadius: 8 },
    statValue: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 9, fontWeight: '500' },

    sectionContainer: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },

    kpiCard: { width: 105, height: 85, padding: 10, borderRadius: 12, borderWidth: 1, marginRight: 0, justifyContent: 'space-between' },
    miniBarBG: { height: 3, width: '100%', borderRadius: 1.5, marginTop: 6 },
    miniBarFill: { height: '100%', borderRadius: 2 },

    metricCard: { flex: 1, padding: 12, borderRadius: 12, marginBottom: 8 },

    cardList: { borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
});
