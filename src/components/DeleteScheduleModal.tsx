import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';

export type DeleteScope = 'this' | 'this_and_following' | 'all';

interface DeleteScheduleModalProps {
  visible: boolean;
  isRepeating: boolean;
  title: string;
  onDelete: (scope: DeleteScope) => void;
  onClose: () => void;
}

export default function DeleteScheduleModal({
  visible,
  isRepeating,
  title,
  onDelete,
  onClose,
}: DeleteScheduleModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}>
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
              {/* Handle bar */}
              <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-4" />

              {/* Header */}
              <View className="mb-2">
                <Text className="text-gray-800 text-base font-bold">Delete event</Text>
                <Text className="text-gray-400 text-sm mt-1" numberOfLines={1}>
                  {title}
                </Text>
              </View>

              <View className="h-px bg-gray-100 my-4" />

              {isRepeating ? (
                <>
                  {/* This event */}
                  <Option
                    label="This event"
                    description="Remove only this occurrence"
                    onPress={() => onDelete('this')}
                    color="#F97316"
                  />
                  <View className="h-px bg-gray-100 my-2" />

                  {/* This and following */}
                  <Option
                    label="This and following events"
                    description="Remove this and all future occurrences"
                    onPress={() => onDelete('this_and_following')}
                    color="#EF4444"
                  />
                  <View className="h-px bg-gray-100 my-2" />

                  {/* All events */}
                  <Option
                    label="All events"
                    description="Remove every occurrence and the rule"
                    onPress={() => onDelete('all')}
                    color="#EF4444"
                  />
                </>
              ) : (
                /* Non-repeating — single confirm option */
                <Option
                  label="Delete this event"
                  description="This action cannot be undone"
                  onPress={() => onDelete('all')}
                  color="#EF4444"
                />
              )}

              <View className="h-px bg-gray-100 my-4" />

              {/* Cancel */}
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
      {/* Colored dot */}
      <View
        className="w-2 h-2 rounded-full mt-0.5"
        style={{backgroundColor: color}}
      />
      <View className="flex-1">
        <Text className="text-gray-800 text-sm font-semibold" style={{color}}>
          {label}
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5">{description}</Text>
      </View>
      <Text className="text-gray-300 text-lg">›</Text>
    </TouchableOpacity>
  );
}
