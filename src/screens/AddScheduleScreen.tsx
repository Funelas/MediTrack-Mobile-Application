import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import RadioSelectModal from '../components/RadioSelectModal';
import CustomRepeatModal from '../components/CustomRepeatModal';
import Calendar from '../assets/svg_icons/calendar.svg';
import Clock from '../assets/svg_icons/clock.svg';
const REPEAT_OPTIONS = ['Does not repeat', 'Every day', 'Every week', 'Every month', 'Custom'];
const REMINDER_OPTIONS = ['At time of event', '5 mins before', '15 mins before', '30 mins before', '1 hour before'];

interface AddScheduleScreenProps {
  route: {params: {type: 'reminder' | 'appointment'}};
}

export default function AddScheduleScreen({route}: AddScheduleScreenProps) {
  const {type} = route.params;
  const navigation = useNavigation();
  const isAppointment = type === 'appointment';

  const [name, setName] = useState('');
  const [doctorClinic, setDoctorClinic] = useState('');
  const [location, setLocation] = useState('');
  const [repeat, setRepeat] = useState('Does not repeat');
  const [reminder, setReminder] = useState('1 hour before');
  const [notes, setNotes] = useState('');

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const formattedDate = date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
  const formattedTime = time.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});

  const handleRepeatSave = (value: string) => {
    if (value === 'Custom') {
      setShowCustomRepeat(true);
    } else {
      setRepeat(value);
    }
  };

  const title = isAppointment ? 'Add Appointment' : 'Add Reminder';
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
        <Text className="text-gray-700 text-sm font-medium mb-2">
          {isAppointment ? 'Appointment Name:' : 'Reminder Name:'}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter event name:"
          placeholderTextColor="#9ca3af"
          className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
        />

        {/* Doctor / Clinic */}
        {isAppointment && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-2">Doctor / Clinic</Text>
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
            <Text className="text-gray-700 text-sm font-medium mb-2">Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl px-4 py-3">
              <Calendar width={20} height={20} color='black'/>
              <Text className="text-gray-600 text-sm">{formattedDate}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-2">Time</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl px-4 py-3">
              <Clock width={20} height={20} color='black'/>
              <Text className="text-gray-600 text-sm">{formattedTime}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location */}
        {isAppointment && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-2">Location</Text>
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
        <Text className="text-gray-700 text-sm font-medium mb-2">Repeat</Text>
        <TouchableOpacity
          onPress={() => setShowRepeatModal(true)}
          className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-600 text-sm">{repeat}</Text>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Reminder */}
        <Text className="text-gray-700 text-sm font-medium mb-2">Reminder</Text>
        <TouchableOpacity
          onPress={() => setShowReminderModal(true)}
          className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-600 text-sm">{reminder}</Text>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text className="text-gray-700 text-sm font-medium mb-2">Notes</Text>
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

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) setDate(selected);
          }}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowTimePicker(false);
            if (selected) setTime(selected);
          }}
        />
      )}

      {/* Repeat Modal */}
      <RadioSelectModal
        visible={showRepeatModal}
        title="Repeat"
        options={REPEAT_OPTIONS}
        selected={repeat}
        onSave={handleRepeatSave}
        onClose={() => setShowRepeatModal(false)}
      />

      {/* Custom Repeat Modal */}
      <CustomRepeatModal
        visible={showCustomRepeat}
        onSave={value => setRepeat(value)}
        onClose={() => setShowCustomRepeat(false)}
      />

      {/* Reminder Modal */}
      <RadioSelectModal
        visible={showReminderModal}
        title="Reminder"
        options={REMINDER_OPTIONS}
        selected={reminder}
        onSave={value => setReminder(value)}
        onClose={() => setShowReminderModal(false)}
      />

    </SafeAreaView>
  );
}
