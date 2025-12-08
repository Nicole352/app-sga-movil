import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { API_URL } from '../../../constants/config';

interface Auditoria {
  id_auditoria: number;
  tabla_afectada: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  descripcion: string;
  detalles: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    username: string;
    email: string;
    rol: string;
  };
  fecha_operacion: string;
  ip_address: string | null;
}

export default function AuditoriaScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperation, setFilterOperation] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<Auditoria | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, hoy: 0 });

  const theme = darkMode
    ? {
        bg: '#0a0a0a',
        cardBg: 'rgba(18, 18, 18, 0.95)',
        text: '#fff',
        textSecondary: 'rgba(255, 255, 255, 0.7)',
        textMuted: 'rgba(255, 255, 255, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
        inputBg: 'rgba(255, 255, 255, 0.06)',
        inputBorder: 'rgba(255, 255, 255, 0.12)',
      }
    : {
        bg: '#f8fafc',
        cardBg: 'rgba(255, 255, 255, 0.95)',
        text: '#1e293b',
        textSecondary: 'rgba(30, 41, 59, 0.7)',
        textMuted: 'rgba(30, 41, 59, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
        inputBg: 'rgba(0, 0, 0, 0.05)',
        inputBorder: 'rgba(0, 0, 0, 0.15)',
      };

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };
    loadDarkMode();

    const handleDarkModeChange = (value: boolean) => {
      setDarkMode(value);
    };

    eventEmitter.on('darkModeChanged', handleDarkModeChange);

    return () => {
      eventEmitter.off('darkModeChanged', handleDarkModeChange);
    };
  }, []);

  const loadAuditorias = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) return;

      const params = new URLSearchParams({
        pagina: '1',
        limite: '50',
      });

      if (searchTerm) params.append('busqueda', searchTerm);
      if (filterOperation) params.append('operacion', filterOperation);

      const response = await fetch(
        `${API_URL}/auditoria/historial-completo?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAuditorias(data.data.auditorias);
          setStats({
            total: data.data.total,
            hoy: data.data.hoy || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error cargando auditorías:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadAuditorias();
      setLoading(false);
    };
    init();
  }, [searchTerm, filterOperation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAuditorias();
    setRefreshing(false);
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOperacionBadge = (operacion: string) => {
    const badges: Record<
      string,
      { bg: string; text: string; label: string; icon: string }
    > = {
      INSERT: {
        bg: 'rgba(34, 197, 94, 0.2)',
        text: '#4ade80',
        label: 'CREACIÓN',
        icon: 'add-circle',
      },
      UPDATE: {
        bg: 'rgba(59, 130, 246, 0.2)',
        text: '#60a5fa',
        label: 'MODIFICACIÓN',
        icon: 'create',
      },
      DELETE: {
        bg: 'rgba(239, 68, 68, 0.25)',
        text: '#f87171',
        label: 'ELIMINACIÓN',
        icon: 'trash',
      },
    };
    return (
      badges[operacion] || {
        bg: 'rgba(255, 255, 255, 0.1)',
        text: 'rgba(255, 255, 255, 0.7)',
        label: operacion,
        icon: 'help-circle',
      }
    );
  };

  const getTablaIcon = (tabla: string): string => {
    const iconMap: Record<string, string> = {
      cursos: 'book-outline',
      matriculas: 'school-outline',
      pagos_mensuales: 'card-outline',
      docentes: 'people-outline',
      estudiantes: 'people-outline',
      usuarios: 'person-outline',
      sesiones_usuario: 'log-in-outline',
      notificaciones: 'notifications-outline',
    };
    return iconMap[tabla] || 'server-outline';
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.bg, justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      >
        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <Ionicons name="document-text" size={24} color={theme.accent} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.total}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total Registros
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <Ionicons name="today" size={24} color="#4ade80" />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.hoy}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Hoy
            </Text>
          </View>
        </View>

        {/* Búsqueda y filtros */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
            ]}
          >
            <Ionicons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Buscar en auditoría..."
              placeholderTextColor={theme.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <View style={styles.filterGrid}>
            {[
              { value: '', label: 'Todos', icon: 'apps' },
              { value: 'INSERT', label: 'Creación', icon: 'add-circle' },
              { value: 'UPDATE', label: 'Modificación', icon: 'create' },
              { value: 'DELETE', label: 'Eliminación', icon: 'trash' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.value || 'all'}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      filterOperation === filter.value ? theme.accent : theme.inputBg,
                    borderColor:
                      filterOperation === filter.value ? theme.accent : theme.inputBorder,
                  },
                ]}
                onPress={() => setFilterOperation(filter.value)}
              >
                <Ionicons
                  name={filter.icon as any}
                  size={18}
                  color={filterOperation === filter.value ? '#fff' : theme.textMuted}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    {
                      color: filterOperation === filter.value ? '#fff' : theme.text,
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lista de auditorías */}
        <View style={styles.listContainer}>
          {auditorias.map((audit) => {
            const badge = getOperacionBadge(audit.operacion);
            return (
              <TouchableOpacity
                key={audit.id_auditoria}
                style={[
                  styles.auditCard,
                  { backgroundColor: theme.cardBg, borderColor: theme.border },
                ]}
                onPress={() => {
                  setSelectedAudit(audit);
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.auditHeader}>
                  <View
                    style={[
                      styles.auditIcon,
                      { backgroundColor: badge.bg, borderColor: badge.text },
                    ]}
                  >
                    <Ionicons
                      name={getTablaIcon(audit.tabla_afectada) as any}
                      size={20}
                      color={badge.text}
                    />
                  </View>
                  <View style={styles.auditInfo}>
                    <Text style={[styles.auditTable, { color: theme.text }]} numberOfLines={1}>
                      {audit.tabla_afectada.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <Text
                      style={[styles.auditDescription, { color: theme.textSecondary }]}
                      numberOfLines={2}
                    >
                      {audit.descripcion}
                    </Text>
                  </View>
                </View>

                <View style={[styles.operationBadge, { backgroundColor: badge.bg }]}>
                  <Ionicons name={badge.icon as any} size={14} color={badge.text} />
                  <Text style={[styles.operationBadgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>

                <View style={styles.auditFooter}>
                  <View style={styles.auditUser}>
                    <Ionicons name="person" size={14} color={theme.textMuted} />
                    <Text style={[styles.auditUserText, { color: theme.textMuted }]}>
                      {audit.usuario.nombre} {audit.usuario.apellido}
                    </Text>
                  </View>
                  <Text style={[styles.auditDate, { color: theme.textMuted }]}>
                    {formatearFecha(audit.fecha_operacion)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de detalles */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.cardBg, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Detalles de Auditoría
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedAudit && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Tabla:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {selectedAudit.tabla_afectada}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Operación:
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: getOperacionBadge(selectedAudit.operacion).text },
                      ]}
                    >
                      {getOperacionBadge(selectedAudit.operacion).label}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Usuario:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {selectedAudit.usuario.nombre} {selectedAudit.usuario.apellido}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Rol:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {selectedAudit.usuario.rol}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Fecha:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {formatearFecha(selectedAudit.fecha_operacion)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted }]}>
                      Email:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {selectedAudit.usuario.email}
                    </Text>
                  </View>

                  <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={[styles.detailLabel, { color: theme.textMuted, marginBottom: 8 }]}>
                      Descripción:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {selectedAudit.descripcion}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.accent }]}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  searchContainer: {
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  auditCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  auditIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    flexShrink: 0,
  },
  auditInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  auditTable: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  auditDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  operationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  auditFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  auditUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditUserText: {
    fontSize: 12,
  },
  auditDate: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  operationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
