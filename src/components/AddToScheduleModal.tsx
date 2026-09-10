import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Calendar from '../assets/svg_icons/calendar.svg';
import Meds from '../assets/svg_icons/navigation_icons/meds.svg';
import Bell from '../assets/svg_icons/bell.svg';
interface AddToScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAppointment: () => void;
  onSelectReminder: () => void;
}

export default function AddToScheduleModal({
  visible,
  onClose,
  onSelectAppointment,
  onSelectReminder,
}: AddToScheduleModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24}}>
          {/* Modal Card */}
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-2xl w-full p-5">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-gray-800 text-base font-bold">Add to Schedule</Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Text className="text-gray-400 text-lg font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-gray-400 text-sm mb-4">What would you like to add?</Text>

              {/* Appointment Option */}
              <TouchableOpacity
                onPress={onSelectAppointment}
                className="flex-row items-center justify-center gap-3 p-3 rounded-xl mb-5 border border-gray-100">
                {/* Icon placeholder */}
                <View className="w-10 h-10 bg-red-100 rounded-xl items-center justify-center">
                  <Calendar width={25} height={25} color='#F15C5C'/>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm">Appointment</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">Doctor visits and consultations</Text>
                </View>
                <Text className="text-gray-400 text-lg">›</Text>
              </TouchableOpacity>

              {/* Reminder Option */}
              <TouchableOpacity
                onPress={onSelectReminder}
                className="flex-row items-center gap-3 p-3 rounded-xl mb-4 border border-gray-100">
                {/* Icon placeholder */}
                <View className="w-10 h-10 bg-yellow-100 rounded-xl items-center justify-center">
                  <Bell width={25} height={25} color='#E2EA00'/>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm">Reminder</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">General reminders like refills and follow-ups</Text>
                </View>
                <Text className="text-gray-400 text-lg">›</Text>
              </TouchableOpacity>

              {/* Meds note */}
              <View
                className="flex-row items-center gap-3 px-3 rounded-xl">
                {/* Icon placeholder */}
                <View className="w-10 h-10 rounded-xl items-center justify-center">
                  <Meds width={25} height={25} color='#139880'/>
                </View>
                {/* Icon placeholder */}
                
                <Text className="text-gray-400 text-xs flex-1">
                  Medication schedules are managed in the Meds Section
                </Text>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
