import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Notificacion } from '../hooks/useNotifications';

interface NotificationBellProps {
  notificaciones: Notificacion[];
  onMarcarTodasLeidas: () => void;
  darkMode: boolean;
}

export default function NotificationBell({
  notificaciones,
  onMarcarTodasLeidas,
  darkMode
}: NotificationBellProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const notificacionesVisibles = mostrarHistorial
    ? notificaciones
    : notificaciones.filter(n => !n.leida);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  const getIconoTipo = (tipo: string) => {
    switch (tipo) {
      case 'modulo': return 'library';
      case 'tarea': return 'cloud-upload';
      case 'pago': return 'cash';
      case 'calificacion': return 'star';
      case 'matricula': return 'people';
      default: return 'notifications';
    }
  };

  const getColorTipo = (tipo: string) => {
    switch (tipo) {
      case 'modulo': return '#3b82f6'; // Blue
      case 'tarea': return '#10b981'; // Green (matches web submission)
      case 'pago': return '#10b981'; // Green
      case 'calificacion': return '#8b5cf6'; // Purple
      case 'matricula': return '#ec4899'; // Pink
      default: return '#6b7280';
    }
  };

  const formatearFecha = (fecha: Date) => {
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos}m`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const handleNotificationPress = (notif: Notificacion) => {
    setShowModal(false);
    if (notif.link) {
      router.push(notif.link as any);
    }
  };

  const theme = darkMode ? {
    bg: '#1a1a1a',
    card: 'rgba(26, 26, 26, 0.95)',
    text: '#fff',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.5)',
    border: 'rgba(59, 130, 246, 0.2)',
    accent: '#3b82f6',
    bellColor: '#d1d5db',
  } : {
    bg: '#ffffff',
    card: 'rgba(255, 255, 255, 0.95)',
    text: '#1e293b',
    textSecondary: 'rgba(30,41,59,0.7)',
    textMuted: 'rgba(30,41,59,0.5)',
    border: 'rgba(59, 130, 246, 0.2)',
    accent: '#3b82f6',
    bellColor: '#6b7280',
  };

  return (
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="notifications" size={24} color={theme.bellColor} />
        {noLeidas > 0 && (
          <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.badgeText}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalContent, { backgroundColor: theme.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.headerLeft}>
                <Ionicons name="notifications" size={24} color={theme.bellColor} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  Notificaciones
                </Text>
                {noLeidas > 0 && (
                  <View style={[styles.headerBadge, { backgroundColor: '#ef4444' }]}>
                    <Text style={styles.headerBadgeText}>{noLeidas}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Botón marcar todas como leídas */}
            {noLeidas > 0 && (
              <TouchableOpacity
                style={[styles.markAllButton, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}
                onPress={() => {
                  onMarcarTodasLeidas();
                }}
              >
                <Ionicons name="checkmark-done" size={18} color={theme.accent} />
                <Text style={[styles.markAllText, { color: theme.accent }]}>
                  Marcar todas como leídas
                </Text>
              </TouchableOpacity>
            )}

            {/* Lista de notificaciones */}
            <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
              {notificacionesVisibles.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off" size={48} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    {mostrarHistorial
                      ? 'No tienes notificaciones en el historial'
                      : 'No tienes notificaciones nuevas'}
                  </Text>
                  {!mostrarHistorial && (
                    <TouchableOpacity onPress={() => setMostrarHistorial(true)} style={{ marginTop: 8 }}>
                      <Text style={{ color: theme.accent, fontSize: 14 }}>Ver historial</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                notificacionesVisibles.map((notif) => (
                  <TouchableOpacity
                    key={notif.id}
                    style={[
                      styles.notificationItem,
                      {
                        backgroundColor: notif.leida ? 'transparent' : (darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)'),
                        borderBottomColor: theme.border
                      }
                    ]}
                    onPress={() => handleNotificationPress(notif)}
                  >
                    <View style={[styles.notificationIcon, { backgroundColor: getColorTipo(notif.tipo) + '20' }]}>
                      <Ionicons name={getIconoTipo(notif.tipo) as any} size={20} color={getColorTipo(notif.tipo)} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationTitle, { color: theme.text }]} numberOfLines={1}>
                        {notif.titulo}
                      </Text>
                      <Text style={[styles.notificationMessage, { color: theme.textSecondary }]} numberOfLines={2}>
                        {notif.mensaje}
                      </Text>
                      <Text style={[styles.notificationTime, { color: theme.textMuted }]}>
                        {formatearFecha(notif.fecha)}
                      </Text>
                    </View>
                    {!notif.leida && (
                      <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>


            {/* Footer Historial */}
            {(notificaciones.length > 0 || mostrarHistorial) && (
              <View style={[styles.historyFooter, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  onPress={() => setMostrarHistorial(!mostrarHistorial)}
                  style={styles.historyButton}
                >
                  <Text style={[styles.historyText, { color: theme.textMuted }]}>
                    {mostrarHistorial ? 'Ocultar historial' : 'Ver historial completo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal >
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationsList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  historyFooter: {
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  historyButton: {
    padding: 4,
  },
  historyText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
