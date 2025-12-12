import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';

interface ModalModuloProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  id_curso: string;
  moduloEditar?: any;
}

export default function ModalModulo({
  visible,
  onClose,
  onSuccess,
  id_curso,
  moduloEditar
}: ModalModuloProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'activo'
  });
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<{
    show: boolean;
    field: 'fecha_inicio' | 'fecha_fin';
    value: Date;
  } | null>(null);

  useEffect(() => {
    loadDarkMode();
  }, []);

  useEffect(() => {
    if (moduloEditar) {
      setFormData({
        nombre: moduloEditar.nombre || '',
        descripcion: moduloEditar.descripcion || '',
        fecha_inicio: moduloEditar.fecha_inicio ? moduloEditar.fecha_inicio.split('T')[0] : '',
        fecha_fin: moduloEditar.fecha_fin ? moduloEditar.fecha_fin.split('T')[0] : '',
        estado: moduloEditar.estado || 'activo'
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'activo'
      });
    }
  }, [moduloEditar, visible]);

  const loadDarkMode = async () => {
    const mode = await getDarkMode();
    setDarkMode(mode);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(null);
      return;
    }

    if (selectedDate && showDatePicker) {
      const dateString = selectedDate.toISOString().split('T')[0];
      setFormData({
        ...formData,
        [showDatePicker.field]: dateString
      });
    }
    setShowDatePicker(null);
  };

  const openDatePicker = (field: 'fecha_inicio' | 'fecha_fin') => {
    const currentValue = formData[field];
    const dateValue = currentValue ? new Date(currentValue) : new Date();

    setShowDatePicker({
      show: true,
      field,
      value: dateValue
    });
  };

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre del módulo es obligatorio');
      return;
    }

    try {
      setLoading(true);
      const token = await getToken();

      const dataToSend = {
        ...formData,
        id_curso: parseInt(id_curso)
      };

      const url = moduloEditar
        ? `${API_URL}/modulos/${moduloEditar.id_modulo}`
        : `${API_URL}/modulos`;

      const response = await fetch(url, {
        method: moduloEditar ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        Alert.alert(
          'Éxito',
          moduloEditar ? 'Módulo actualizado exitosamente' : 'Módulo creado exitosamente'
        );
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Error al guardar módulo');
      }
    } catch (error: any) {
      console.error('Error saving modulo:', error);
      Alert.alert('Error', 'Error al guardar módulo');
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.9)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    accent: '#3b82f6',
    inputBg: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <Ionicons name="document-text" size={20} color={theme.accent} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {moduloEditar ? 'Editar Módulo' : 'Nuevo Módulo'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, {
                backgroundColor: theme.inputBg,
                borderColor: theme.border
              }]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Nombre */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Nombre del Módulo *
              </Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                  color: theme.text
                }]}
                placeholder="Ej: Parcial 1, Unidad Básica, Módulo Introductorio"
                placeholderTextColor={theme.textMuted}
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text })}
              />
            </View>

            {/* Descripción */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Descripción (opcional)
              </Text>
              <TextInput
                style={[styles.textArea, {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                  color: theme.text
                }]}
                placeholder="Describe brevemente el contenido de este módulo..."
                placeholderTextColor={theme.textMuted}
                value={formData.descripcion}
                onChangeText={(text) => setFormData({ ...formData, descripcion: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Fechas */}
            <View style={styles.dateRow}>
              {/* Fecha Inicio */}
              <View style={styles.dateField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Fecha Inicio (opcional)
                </Text>
                <TouchableOpacity
                  style={[styles.dateButton, {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border
                  }]}
                  onPress={() => openDatePicker('fecha_inicio')}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.accent} />
                  <Text style={[styles.dateText, {
                    color: formData.fecha_inicio ? theme.text : theme.textMuted
                  }]}>
                    {formData.fecha_inicio
                      ? new Date(formData.fecha_inicio).toLocaleDateString('es-ES')
                      : 'Seleccionar'
                    }
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Fecha Fin */}
              <View style={styles.dateField}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Fecha Fin (opcional)
                </Text>
                <TouchableOpacity
                  style={[styles.dateButton, {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.border
                  }]}
                  onPress={() => openDatePicker('fecha_fin')}
                >
                  <Ionicons name="calendar-outline" size={18} color={theme.accent} />
                  <Text style={[styles.dateText, {
                    color: formData.fecha_fin ? theme.text : theme.textMuted
                  }]}>
                    {formData.fecha_fin
                      ? new Date(formData.fecha_fin).toLocaleDateString('es-ES')
                      : 'Seleccionar'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={showDatePicker.value}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, {
                backgroundColor: theme.inputBg,
                borderColor: theme.border
              }]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, {
                backgroundColor: loading ? 'rgba(59, 130, 246, 0.6)' : theme.accent,
                opacity: loading ? 0.7 : 1
              }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.buttonText, { color: '#fff', marginLeft: 8 }]}>
                    Guardando...
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={[styles.buttonText, { color: '#fff', marginLeft: 6 }]}>
                    {moduloEditar ? 'Actualizar' : 'Crear Módulo'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBody: {
    maxHeight: '70%',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 70,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  dateField: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 14,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonPrimary: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
