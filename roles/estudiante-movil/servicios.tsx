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
      contact: 'pagos@sgabelleza.edu.ec',
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
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={darkMode ? ['#b45309', '#78350f'] : ['#fbbf24', '#d97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Servicios</Text>
              <Text style={styles.headerSubtitle}>Estudiantiles</Text>
            </View>
            <View style={styles.headerIconContainer}>
              <Ionicons name="apps" size={24} color="#fff" />
            </View>
          </View>
        </LinearGradient>
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
            <LinearGradient
              colors={theme.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.serviceCard}
            >
              {/* Decorative Circle Background */}
              <View style={styles.decorativeCircle} />

              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name={service.icon as any} size={28} color={theme.accent} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.serviceTitle}>{service.title}</Text>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Disponible</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.descriptionText}>
                {service.description}
              </Text>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {service.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Ionicons name={feature.icon as any} size={14} color="#fff" />
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                ))}
              </View>

              {/* Contact Info (Glass effect) */}
              <View style={styles.contactContainer}>
                <View style={styles.contactRow}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.contactText}>{service.schedule}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.contactText}>{service.contact}</Text>
                </View>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push(`/roles/estudiante-movil/${service.route}` as any)}
                activeOpacity={0.9}
              >
                <Text style={[styles.actionButtonText, { color: theme.accent }]}>
                  {service.action}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={theme.accent} />
              </TouchableOpacity>

            </LinearGradient>
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
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginTop: -4,
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
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
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
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
    backgroundColor: '#fff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981', // Green dot always visible on white/gold
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  featureText: {
    color: '#fff',
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
    color: 'rgba(255,255,255,0.9)',
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
