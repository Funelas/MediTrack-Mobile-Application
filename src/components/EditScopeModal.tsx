import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';

export type EditScope = 'this' | 'this_and_following' | 'all';

interface EditScopeModalProps {
  visible: boolean;
  isRepeating: boolean;
  title: string;
  onSelect: (scope: EditScope) => void;
  onClose: () => void;
}

export default function EditScopeModal({
  visible,
  isRepeating,
  title,
  onSelect,
  onClose,
}: EditScopeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'}}>
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
              {/* Handle */}
              <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-4" />

              {/* Header */}
              <View className="mb-2">
                <Text className="text-gray-800 text-base font-bold">Edit event</Text>
                <Text className="text-gray-400 text-sm mt-1" numberOfLines={1}>
                  {title}
                </Text>
              </View>

              <View className="h-px bg-gray-100 my-4" />

              {isRepeating ? (
                <>
                  <Option
                    label="This event"
                    description="Edit only this occurrence — other events stay the same"
                    onPress={() => onSelect('this')}
                    color="#14B8A6"
                  />
                  <View className="h-px bg-gray-100 my-2" />
                  <Option
                    label="This and following events"
                    description="Split the series here — edit this and all future occurrences"
                    onPress={() => onSelect('this_and_following')}
                    color="#3B82F6"
                  />
                  <View className="h-px bg-gray-100 my-2" />
                  <Option
                    label="All events"
                    description="Edit every occurrence in the series"
                    onPress={() => onSelect('all')}
                    color="#6B7280"
                  />
                </>
              ) : (
                <Option
                  label="Edit this event"
                  description="Update the details of this event"
                  onPress={() => onSelect('all')}
                  color="#14B8A6"
                />
              )}

              <View className="h-px bg-gray-100 my-4" />

              <TouchableOpacity
                onPress={onClose}
                className="py-3 items-center rounded-2xl border border-gray-200">
                <Text className="text-gray-600 text-sm font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function Option({
  label,
  description,
  onPress,
  color,
}: {
  label: string;
  description: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-4 py-3 px-1">
      <View className="w-2 h-2 rounded-full mt-0.5" style={{backgroundColor: color}} />
      <View className="flex-1">
        <Text className="text-sm font-semibold" style={{color}}>{label}</Text>
        <Text className="text-gray-400 text-xs mt-0.5">{description}</Text>
      </View>
      <Text className="text-gray-300 text-lg">›</Text>
    </TouchableOpacity>
  );
}
