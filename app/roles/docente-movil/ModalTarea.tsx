import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';

interface ModalTareaProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  id_modulo: number;
  tareaEditar?: any;
}

export default function ModalTarea({ visible, onClose, onSuccess, id_modulo, tareaEditar }: ModalTareaProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    instrucciones: '',
    nota_maxima: '10',
    nota_minima_aprobacion: '7',
    ponderacion: '1',
    fecha_limite: new Date(),
    permite_archivo: true,
    tamano_maximo_mb: '5',
    formatos_permitidos: 'pdf,jpg,jpeg,png,webp',
    estado: 'activo'
  });
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadDarkMode();
  }, []);

  useEffect(() => {
    if (tareaEditar) {
      let fechaLimite = new Date();
      if (tareaEditar.fecha_limite) {
        fechaLimite = new Date(tareaEditar.fecha_limite);
      }

      setFormData({
        titulo: tareaEditar.titulo || '',
        descripcion: tareaEditar.descripcion || '',
        instrucciones: tareaEditar.instrucciones || '',
        nota_maxima: tareaEditar.nota_maxima?.toString() || '10',
        nota_minima_aprobacion: tareaEditar.nota_minima_aprobacion?.toString() || '7',
        ponderacion: tareaEditar.ponderacion?.toString() || '1',
        fecha_limite: fechaLimite,
        permite_archivo: tareaEditar.permite_archivo !== false,
        tamano_maximo_mb: tareaEditar.tamano_maximo_mb?.toString() || '5',
        formatos_permitidos: tareaEditar.formatos_permitidos || 'pdf,jpg,jpeg,png,webp',
        estado: tareaEditar.estado || 'activo'
      });
    } else {
      resetForm();
    }
  }, [tareaEditar, visible]);

  const loadDarkMode = async () => {
    const mode = await getDarkMode();
    setDarkMode(mode);
  };

  const resetForm = () => {
    // Fecha por defecto: mañana a las 23:59 (para pasar validación de fecha futura)
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(23, 59, 0, 0);

    setFormData({
      titulo: '',
      descripcion: '',
      instrucciones: '',
      nota_maxima: '10',
      nota_minima_aprobacion: '7',
      ponderacion: '1',
      fecha_limite: manana,
      permite_archivo: true,
      tamano_maximo_mb: '5',
      formatos_permitidos: 'pdf,jpg,jpeg,png,webp',
      estado: 'activo'
    });
  };

  const handleSave = async () => {
    if (!formData.titulo.trim()) {
      Alert.alert('Error', 'El título es requerido');
      return;
    }

    // Validar que la fecha límite sea futura (solo al crear, no al editar)
    if (!tareaEditar) {
      const fechaLimite = new Date(formData.fecha_limite);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      if (fechaLimite < hoy) {
        Alert.alert('Error', 'La fecha límite debe ser futura');
        return;
      }
    }

    setLoading(true);
    try {
      const token = await getToken();
      const url = tareaEditar
        ? `${API_URL}/tareas/${tareaEditar.id_tarea}`
        : `${API_URL}/tareas`;

      const method = tareaEditar ? 'PUT' : 'POST';

      console.log('🔍 id_modulo recibido:', id_modulo);

      // Formatear fecha como datetime-local (igual que la web)
      const formatDateTimeLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      // Construir payload limpio
      const payload = {
        id_modulo,
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        instrucciones: formData.instrucciones.trim(),
        nota_maxima: parseFloat(formData.nota_maxima),
        nota_minima_aprobacion: parseFloat(formData.nota_minima_aprobacion),
        ponderacion: parseFloat(formData.ponderacion),
        fecha_limite: formatDateTimeLocal(formData.fecha_limite),
        permite_archivo: formData.permite_archivo,
        tamano_maximo_mb: parseInt(formData.tamano_maximo_mb),
        formatos_permitidos: formData.formatos_permitidos,
        estado: formData.estado
      };

      console.log('📦 Enviando tarea:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 Respuesta status:', response.status);

      if (response.ok) {
        Alert.alert('Éxito', tareaEditar ? 'Tarea actualizada' : 'Tarea creada');
        resetForm();
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        console.log('❌ Error del servidor:', errorData);
        Alert.alert('Error', errorData.error || 'No se pudo guardar la tarea');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al guardar la tarea');
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {tareaEditar ? 'Editar Tarea' : 'Nueva Tarea'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Título */}
            <Text style={[styles.label, { color: theme.text }]}>Título *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Título de la tarea"
              placeholderTextColor={theme.textMuted}
              value={formData.titulo}
              onChangeText={(text) => setFormData({ ...formData, titulo: text })}
            />

            {/* Descripción */}
            <Text style={[styles.label, { color: theme.text }]}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Descripción de la tarea"
              placeholderTextColor={theme.textMuted}
              value={formData.descripcion}
              onChangeText={(text) => setFormData({ ...formData, descripcion: text })}
              multiline
              numberOfLines={3}
            />

            {/* Instrucciones */}
            <Text style={[styles.label, { color: theme.text }]}>Instrucciones</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Instrucciones detalladas"
              placeholderTextColor={theme.textMuted}
              value={formData.instrucciones}
              onChangeText={(text) => setFormData({ ...formData, instrucciones: text })}
              multiline
              numberOfLines={3}
            />

            {/* Notas */}
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: theme.text }]}>Nota Máxima</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="10"
                  placeholderTextColor={theme.textMuted}
                  value={formData.nota_maxima}
                  onChangeText={(text) => setFormData({ ...formData, nota_maxima: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.halfWidth}>
                <Text style={[styles.label, { color: theme.text }]}>Nota Mínima</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="7"
                  placeholderTextColor={theme.textMuted}
                  value={formData.nota_minima_aprobacion}
                  onChangeText={(text) => setFormData({ ...formData, nota_minima_aprobacion: text })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Ponderación */}
            <Text style={[styles.label, { color: theme.text }]}>Ponderación</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="1"
              placeholderTextColor={theme.textMuted}
              value={formData.ponderacion}
              onChangeText={(text) => setFormData({ ...formData, ponderacion: text })}
              keyboardType="numeric"
            />

            {/* Fecha Límite */}
            <Text style={[styles.label, { color: theme.text }]}>Fecha Límite</Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={theme.accent} />
              <Text style={[styles.dateText, { color: theme.text }]}>
                {formData.fecha_limite.toLocaleDateString('es-ES')} {formData.fecha_limite.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={formData.fecha_limite}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    setFormData({ ...formData, fecha_limite: date });
                    setShowTimePicker(true);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={formData.fecha_limite}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) {
                    setFormData({ ...formData, fecha_limite: date });
                  }
                }}
              />
            )}

            {/* Permite Archivo */}
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: theme.text }]}>Permite Archivo</Text>
              <Switch
                value={formData.permite_archivo}
                onValueChange={(value) => setFormData({ ...formData, permite_archivo: value })}
                trackColor={{ false: '#767577', true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

            {formData.permite_archivo && (
              <>
                <Text style={[styles.label, { color: theme.text }]}>Tamaño Máximo (MB)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="5"
                  placeholderTextColor={theme.textMuted}
                  value={formData.tamano_maximo_mb}
                  onChangeText={(text) => setFormData({ ...formData, tamano_maximo_mb: text })}
                  keyboardType="numeric"
                />

                <Text style={[styles.label, { color: theme.text }]}>Formatos Permitidos</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder="pdf,jpg,jpeg,png,webp"
                  placeholderTextColor={theme.textMuted}
                  value={formData.formatos_permitidos}
                  onChangeText={(text) => setFormData({ ...formData, formatos_permitidos: text })}
                />
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { backgroundColor: theme.accent }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {loading ? 'Guardando...' : 'Guardar'}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    borderWidth: 1,
  },
  buttonPrimary: {},
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
