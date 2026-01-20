import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

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

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#f59e0b',
      accentGradient: ['#f59e0b', '#d97706'] as const,
      cardGradient: ['#141414', '#141414'] as const,
      success: '#10b981',
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b',
      accentGradient: ['#fbbf24', '#f59e0b'] as const,
      cardGradient: ['#fbbf24', '#f59e0b'] as const,
      success: '#059669',
    };

  const services = [
    {
      id: 1,
      title: 'Pagar Mensualidad',
      description: 'Gestiona y paga las mensualidades de tus cursos matriculados de forma rápida y segura',
      icon: 'card-outline',
      status: 'available',
      schedule: '24/7 Online',
      contact: 'escuelajessicavelez@gmail.com',
      action: 'Gestionar Pagos',
      features: [
        { text: 'Historial de pagos', icon: 'calendar-outline' }
      ],
      route: 'pagosmensuales'
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Premium Header Container */}
      {/* Premium Header Container */}
      <View style={[styles.headerContainer, { marginBottom: 0 }]}>
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
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Pagos</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Estudiantiles</Text>
            </View>
            <View style={[styles.headerIconContainer, { backgroundColor: theme.accent + '15' }]}>
              <Ionicons name="apps" size={24} color={theme.accent} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Servicios Disponibles
        </Text>

        {services.map((service, index) => (
          <Animated.View
            key={service.id}
            entering={FadeInDown.delay(index * 200).springify()}
            style={styles.cardContainer}
          >
            <View
              style={[
                styles.serviceCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                  borderWidth: 1,
                  shadowColor: theme.text
                }
              ]}
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.accent + '15' }]}>
                  <Ionicons name={service.icon as any} size={28} color={theme.accent} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.serviceTitle, { color: theme.text }]}>{service.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: theme.success + '15' }]}>
                    <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                    <Text style={[styles.statusText, { color: theme.success }]}>Disponible</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
                {service.description}
              </Text>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {service.features.map((feature, idx) => (
                  <View key={idx} style={[styles.featureItem, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Ionicons name={feature.icon as any} size={14} color={theme.textMuted} />
                    <Text style={[styles.featureText, { color: theme.textMuted }]}>{feature.text}</Text>
                  </View>
                ))}
              </View>

              {/* Contact Info */}
              <View style={[styles.contactContainer, { backgroundColor: theme.bg }]}>
                <View style={styles.contactRow}>
                  <Ionicons name="time-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.contactText, { color: theme.textMuted }]}>{service.schedule}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={14} color={theme.textMuted} />
                  <Text style={[styles.contactText, { color: theme.textMuted }]}>{service.contact}</Text>
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.accent }]}
                onPress={() => router.push(`/roles/estudiante-movil/${service.route}` as any)}
                activeOpacity={0.9}
              >
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                  {service.action}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>

            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
    zIndex: 10
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: -4,
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },

  cardContainer: {
    marginBottom: 20,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  serviceCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeCircle: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 0,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTextContainer: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  descriptionText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: '500',
    zIndex: 1,
  },

  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    zIndex: 1,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
  },

  contactContainer: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 4,
    zIndex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 12,
    fontWeight: '500',
  },

  actionButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  }
});
