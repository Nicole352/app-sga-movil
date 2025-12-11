import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

export default function ServiciosEstudiante() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };
    
    loadDarkMode();
    
    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    accent: '#fbbf24',
    success: '#10b981',
  };

  const services = [
    {
      id: 1,
      title: 'Pagar Mensualidad',
      description: 'Gestiona y paga las mensualidades de tus cursos matriculados de forma rápida y segura',
      icon: 'card',
      status: 'available',
      schedule: '24/7 Online',
      contact: 'pagos@sgabelleza.edu.ec',
      action: 'Gestionar Pagos',
      features: [
        { text: 'Pagos online seguros', icon: 'shield-checkmark' },
        { text: 'Historial de pagos', icon: 'calendar' },
        { text: 'Múltiples métodos de pago', icon: 'flash' }
      ],
      route: 'pagosmensuales'
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Servicios Estudiantiles</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Accede a todos los servicios disponibles
          </Text>
        </View>

        {/* Servicios */}
        <View style={styles.servicesContainer}>
          {services.map((service) => (
            <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header del servicio */}
              <View style={styles.serviceHeader}>
                <View style={[styles.iconContainer, { backgroundColor: `${colors.success}20` }]}>
                  <Ionicons name={service.icon as any} size={24} color={colors.success} />
                </View>
                <View style={styles.serviceHeaderInfo}>
                  <Text style={[styles.serviceTitle, { color: colors.text }]}>{service.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${colors.success}20`, borderColor: `${colors.success}40` }]}>
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.statusText, { color: colors.success }]}>Disponible</Text>
                  </View>
                </View>
              </View>

              {/* Descripción */}
              <Text style={[styles.serviceDescription, { color: colors.textSecondary }]}>
                {service.description}
              </Text>

              {/* Características */}
              <View style={styles.featuresContainer}>
                <Text style={[styles.featuresTitle, { color: colors.textMuted }]}>CARACTERÍSTICAS:</Text>
                {service.features.map((feature, index) => (
                  <View key={index} style={[styles.featureItem, { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.05)' : 'rgba(251, 191, 36, 0.08)', borderColor: darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.15)' }]}>
                    <View style={[styles.featureIconContainer, { backgroundColor: `${colors.accent}15` }]}>
                      <Ionicons name={feature.icon as any} size={12} color={colors.accent} />
                    </View>
                    <Text style={[styles.featureText, { color: colors.text }]}>{feature.text}</Text>
                  </View>
                ))}
              </View>

              {/* Información de contacto */}
              <View style={[styles.contactContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={styles.contactItem}>
                  <View style={[styles.contactIconContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Ionicons name="time" size={10} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.contactText, { color: colors.textSecondary }]}>{service.schedule}</Text>
                </View>
                <View style={styles.contactItem}>
                  <View style={[styles.contactIconContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
                    <Ionicons name="mail" size={10} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.contactText, { color: colors.textSecondary }]}>{service.contact}</Text>
                </View>
              </View>

              {/* Botón de acción */}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={() => router.push(`/roles/estudiante-movil/${service.route}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="card" size={14} color="#fff" />
                <Text style={styles.actionButtonText}>{service.action}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
  },
  servicesContainer: {
    padding: 16,
    paddingTop: 4,
  },
  serviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceHeaderInfo: {
    flex: 1,
    gap: 6,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  serviceDescription: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  featuresContainer: {
    marginBottom: 12,
  },
  featuresTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  featureIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 10,
    fontWeight: '600',
  },
  contactContainer: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    gap: 6,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
});
