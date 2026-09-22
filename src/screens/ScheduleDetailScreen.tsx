import React from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ScheduleStackParamList} from '../navigation/ScheduleStackNavigator';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Pills from '../assets/svg_icons/pills.svg';

type Nav = NativeStackNavigationProp<ScheduleStackParamList>;
type Route = RouteProp<ScheduleStackParamList, 'ScheduleDetail'>;

// Placeholder data — will come from real data later
const SCHEDULE_ITEMS: Record<string, {
  id: string;
  type: 'reminder' | 'appointment' | 'med';
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  repeat: string;
  reminder: string;
  notes?: string;
  color: string;
  // Appointment-only
  doctorClinic?: string;
  location?: string;
}> = {
  '1': {
    id: '1', type: 'med', title: 'Amlodipine 5mg', subtitle: '1 tablet',
    date: 'Everyday', time: '8:00 AM', repeat: 'Every day',
    reminder: 'At time of event', color: '#14B8A6',
  },
  '2': {
    id: '2', type: 'reminder', title: 'Check Blood Pressure', subtitle: 'Task',
    date: 'Everyday', time: '1:00 PM', repeat: 'Every day',
    reminder: '15 mins before', notes: 'Use the BP monitor in the cabinet.',
    color: '#F97316',
  },
  '3': {
    id: '3', type: 'appointment', title: "Doctor's Appointment",
    doctorClinic: 'Dr. Maria Gaston · Cardiology Clinics',
    location: 'Cardiology Clinics, 2nd Floor, St. Luke\'s Medical Center',
    date: 'Aug 12, 2026', time: '3:00 PM', repeat: 'Does not repeat',
    reminder: '1 hour before', notes: 'Bring latest lab results.',
    color: '#3B82F6',
  },
  '4': {
    id: '4', type: 'reminder', title: 'Restock Medicine', subtitle: 'Task',
    date: 'Everyday', time: '5:00 PM', repeat: 'Every day',
    reminder: 'At time of event', color: '#F97316',
  },
  '5': {
    id: '5', type: 'med', title: 'Atorvastatin 10mg', subtitle: '1 tablet',
    date: 'Everyday', time: '9:00 PM', repeat: 'Every day',
    reminder: 'At time of event', color: '#14B8A6',
  },
};

function DetailRow({icon, label, value}: {icon: React.ReactNode; label: string; value: string}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
      <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-gray-400 text-xs">{label}</Text>
      </View>
      <Text className="text-gray-800 text-sm font-semibold text-right flex-1">{value}</Text>
    </View>
  );
}

export default function ScheduleDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const item = SCHEDULE_ITEMS[params.id];

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Item not found.</Text>
      </SafeAreaView>
    );
  }

  const isAppointment = item.type === 'appointment';
  const isMed = item.type === 'med';
  const accentColor = item.color;

  const headerTitle = isAppointment ? 'Appointment Details'
    : isMed ? 'Medicine Schedule'
    : 'Reminder Details';

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-10 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-gray-800 text-base font-semibold">{headerTitle}</Text>
        {!isMed ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('EditSchedule', {id: item.id, type: item.type as 'reminder' | 'appointment'})}
            className="p-2">
            <Text className="text-teal-500 text-sm font-semibold">Edit</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pt-4 pb-8 gap-4">

          {/* Identity Card */}
          <View className="bg-white rounded-2xl p-4 flex-row items-center gap-4">
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{backgroundColor: accentColor + '22'}}>
              {isAppointment
                ? <Calendar width={28} height={28} color={accentColor} />
                : isMed
                ? <Pills width={28} height={28} color={accentColor} />
                : <Bell width={28} height={28} color={accentColor} />}
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 text-lg font-bold">{item.title}</Text>
              {item.subtitle && <Text className="text-gray-400 text-sm mt-0.5">{item.subtitle}</Text>}
              {item.doctorClinic && <Text className="text-gray-400 text-sm mt-0.5">{item.doctorClinic}</Text>}
            </View>
          </View>

          {/* Schedule Details */}
          <View>
            <Text className="text-sm font-bold mb-2" style={{color: accentColor}}>
              {isAppointment ? 'Appointment Info' : 'Schedule & Reminder'}
            </Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              <DetailRow
                icon={<Calendar width={18} height={18} color="#6B7280" />}
                label="Date"
                value={item.date}
              />
              <DetailRow
                icon={<Clock width={18} height={18} color="#6B7280" />}
                label="Time"
                value={item.time}
              />
              {isAppointment && item.location && (
                <DetailRow
                  icon={<Bell width={18} height={18} color="#6B7280" />}
                  label="Location"
                  value={item.location}
                />
              )}
              <DetailRow
                icon={<Clock width={18} height={18} color="#6B7280" />}
                label="Repeat"
                value={item.repeat}
              />
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Bell width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-400 text-xs">Reminder</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">{item.reminder}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          {item.notes && (
            <View>
              <Text className="text-sm font-bold mb-2" style={{color: accentColor}}>Notes</Text>
              <View className="bg-white rounded-2xl px-4 py-4">
                <Text className="text-gray-600 text-sm">{item.notes}</Text>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
