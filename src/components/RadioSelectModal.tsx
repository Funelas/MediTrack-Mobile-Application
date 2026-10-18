import React, {useState} from 'react';
import {View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback} from 'react-native';

interface RadioSelectModalProps {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function RadioSelectModal({
  visible,
  title,
  options,
  selected,
  onSave,
  onClose,
}: RadioSelectModalProps) {
  const [current, setCurrent] = useState(selected);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24}}>
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-2xl w-full p-5">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-800 text-base font-bold">{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text className="text-gray-400 text-lg font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="h-px bg-gray-100 mb-3" />

              {/* Options */}
              {options.map(option => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setCurrent(option)}
                  className="flex-row items-center gap-3 py-3">
                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${current === option ? 'border-teal-500' : 'border-gray-300'}`}>
                    {current === option && <View className="w-3 h-3 rounded-full bg-teal-500" />}
                  </View>
                  <Text className="text-gray-700 text-sm">{option}</Text>
                </TouchableOpacity>
              ))}

              <View className="h-px bg-gray-100 mt-2 mb-4" />

              {/* Save */}
              <TouchableOpacity
                onPress={() => { onSave(current); onClose(); }}
                className="bg-teal-500 rounded-2xl py-4 items-center">
                <Text className="text-white font-semibold text-base">Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
