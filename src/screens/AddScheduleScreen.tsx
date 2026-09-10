import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Clock from '../assets/svg_icons/clock.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
interface AddScheduleScreenProps {
  route: {params: {type: 'reminder' | 'appointment'}};
}

export default function AddScheduleScreen({route}: AddScheduleScreenProps) {
  const {type} = route.params;
  const navigation = useNavigation();
  const isAppointment = type === 'appointment';

  const [name, setName] = useState('');
  const [doctorClinic, setDoctorClinic] = useState('');
  const [date, setDate] = useState('Aug. 12, 2026');
  const [time, setTime] = useState('3:00 PM');
  const [location, setLocation] = useState('');
  const [repeat, setRepeat] = useState('Does not repeat');
  const [reminder, setReminder] = useState('1 hour before');
  const [notes, setNotes] = useState('');

  const title = isAppointment ? 'Add Appointment' : 'Add Reminder';
  const namePlaceholder = 'Enter event name:';
  const saveLabel = isAppointment ? 'Save Appointment' : 'Save Reminder';

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          {title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4">

        {/* Name */}
        <Text className="text-gray-700 text-sm font-medium mb-1">
          {isAppointment ? 'Appointment Name:' : 'Reminder Name:'}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={namePlaceholder}
          placeholderTextColor="#9ca3af"
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
        />

        {/* Doctor / Clinic (appointment only) */}
        {isAppointment && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-1">Doctor / Clinic</Text>
            <TextInput
              value={doctorClinic}
              onChangeText={setDoctorClinic}
              placeholder="Enter appointment office:"
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
            />
          </>
        )}

        {/* Date & Time */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-1">Date</Text>
            <TouchableOpacity className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl p-4">
              <Calendar width={20} height={20} color="#353638" />
              <Text className="text-gray-600 text-sm">{date}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-1">Time</Text>
            <TouchableOpacity className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl p-4">
              <Clock width={20} height={20} color="#353638" />
              <Text className="text-gray-600 text-sm">{time}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location (appointment only) */}
        {isAppointment && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-1">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location:"
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
            />
          </>
        )}

        {/* Repeat */}
        <Text className="text-gray-700 text-sm font-medium mb-1">Repeat</Text>
        <TouchableOpacity className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-600 text-sm">{repeat}</Text>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Reminder */}
        <Text className="text-gray-700 text-sm font-medium mb-1">Reminder</Text>
        <TouchableOpacity className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-600 text-sm">{reminder}</Text>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text className="text-gray-700 text-sm font-medium mb-1">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes (optional)"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-6"
          style={{minHeight: 100}}
        />

        {/* Save Button */}
        <TouchableOpacity className="bg-teal-500 rounded-2xl py-4 items-center mb-8">
          <Text className="text-white font-semibold text-base">{saveLabel}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
