import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Keep this import, it's standard.
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

    // Helper to find label
    const selectedLabel = items.find(i => i.value === selectedValue)?.label || placeholder || items[0]?.label;

    // ANDROID: Picker Nativo in a container
    if (Platform.OS === 'android') {
        return (
            <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                <Picker
                    selectedValue={selectedValue}
                    onValueChange={onValueChange}
                    style={[styles.picker, { color: theme.text }]}
                    dropdownIconColor={theme.text}
                >
                    {placeholder && <Picker.Item label={placeholder} value="" style={{ color: theme.textMuted }} />}
                    {items.map((item) => (
                        <Picker.Item key={item.value} label={item.label} value={item.value} style={{ fontSize: 16, color: theme.text }} />
                    ))}
                </Picker>
            </View>
        );
    }

    // IOS: Modal con Wheel Picker
    return (
        <>
            <TouchableOpacity
                onPress={() => setShowModal(true)}
                style={[styles.pickerContainer, {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 12,
                    borderColor: theme.border,
                    backgroundColor: theme.inputBg,
                    height: 50 // Match standard input height
                }]}
            >
                <Text style={{ color: selectedValue ? theme.text : theme.textMuted, fontSize: 16 }} numberOfLines={1}>
                    {selectedLabel}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
            </TouchableOpacity>

            <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Listo</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue) => {
                                onValueChange(itemValue);
                            }}
                            style={{ height: 200 }}
                            itemStyle={{ color: theme.text, fontSize: 20 }}
                        >
                            {placeholder && <Picker.Item label={placeholder} value="" />}
                            {items.map((item) => (
                                <Picker.Item key={item.value} label={item.label} value={item.value} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    pickerContainer: {
        borderRadius: 12,
        borderWidth: 1,
        height: 50,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    picker: {
        marginLeft: -8,
        height: 50,
    }
});
