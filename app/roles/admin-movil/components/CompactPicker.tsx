import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

interface PickerItem {
    label: string;
    value: string;
}

interface CompactPickerProps {
    items: PickerItem[];
    selectedValue: string;
    onValueChange: (val: string) => void;
    placeholder?: string;
    theme: any;
}

export default function CompactPicker({
    items,
    selectedValue,
    onValueChange,
    placeholder,
    theme
}: CompactPickerProps) {
    const [showModal, setShowModal] = useState(false);

    // Get current label
    const selectedItem = items.find(i => i.value === selectedValue);
    const selectedLabel = selectedItem?.label || placeholder || (items.length > 0 ? items[0].label : "Seleccionar");

    const handleSelect = (value: string) => {
        onValueChange(value);
        if (Platform.OS === 'android') {
            setShowModal(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowModal(true)}
                activeOpacity={0.7}
                style={[styles.pickerContainer, {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 15,
                    borderColor: theme.border,
                    backgroundColor: theme.cardBg,
                    height: 48 // Professional height
                }]}
            >
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {selectedLabel}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.primary} />
            </TouchableOpacity>

            <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '80%' }}>
                        {/* Toolbar */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
                            </TouchableOpacity>
                            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>Seleccionar</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Listo</Text>
                            </TouchableOpacity>
                        </View>

                        {Platform.OS === 'ios' ? (
                            /* IOS: Picker Wheel */
                            <Picker
                                selectedValue={selectedValue}
                                onValueChange={onValueChange}
                                style={{ height: 250, color: theme.text }}
                                itemStyle={{ color: theme.text, fontSize: 18 }}
                            >
                                {items.map((item) => (
                                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                                ))}
                            </Picker>
                        ) : (
                            /* ANDROID: Professional List */
                            <ScrollView style={{ paddingVertical: 10 }}>
                                {items.map((item) => (
                                    <TouchableOpacity
                                        key={item.value}
                                        style={{
                                            paddingVertical: 15,
                                            paddingHorizontal: 25,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: selectedValue === item.value ? theme.primary + '15' : 'transparent'
                                        }}
                                        onPress={() => handleSelect(item.value)}
                                    >
                                        <Text style={{
                                            color: selectedValue === item.value ? theme.primary : theme.text,
                                            fontSize: 16,
                                            fontWeight: selectedValue === item.value ? '700' : '400'
                                        }}>
                                            {item.label}
                                        </Text>
                                        {selectedValue === item.value && (
                                            <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    pickerContainer: {
        borderRadius: 12,
        borderWidth: 1,
        height: 48,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    picker: {
        height: 48,
    }
});
