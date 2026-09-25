import React, {useEffect, useState} from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ScheduleStackParamList} from '../navigation/ScheduleStackNavigator';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Clock from '../assets/svg_icons/clock.svg';
import {database} from '../database';
import Task from '../database/models/Task';

type Nav = NativeStackNavigationProp<ScheduleStackParamList>;
type Route = RouteProp<ScheduleStackParamList, 'ScheduleDetail'>;

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

/** "HH:MM" → "9:00 AM" */
function formatTimeStr(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
}

export default function ScheduleDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const [item, setItem] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    database
      .get<Task>('tasks')
      .find(params.id)
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#14B8A6" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-gray-400 text-center">
          Item not found. It may have been deleted.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4">
          <Text className="text-teal-500 font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isAppointment = item.type === 'appointment';
  const accentColor = isAppointment ? '#3B82F6' : '#F97316';
  const headerTitle = isAppointment ? 'Appointment Details' : 'Reminder Details';
  const formattedDate = new Date(item.startDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-10 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-gray-800 text-base font-semibold">{headerTitle}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('EditSchedule', {
              id: item.id,
              type: item.type as 'reminder' | 'appointment',
            })
          }
          className="p-2">
          <Text className="text-teal-500 text-sm font-semibold">Edit</Text>
        </TouchableOpacity>
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
                : <Bell width={28} height={28} color={accentColor} />}
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 text-lg font-bold">{item.title}</Text>
              {isAppointment && item.doctorClinic ? (
                <Text className="text-gray-400 text-sm mt-0.5">{item.doctorClinic}</Text>
              ) : null}
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
                label="Start Date"
                value={formattedDate}
              />
              <DetailRow
                icon={<Clock width={18} height={18} color="#6B7280" />}
                label="Time"
                value={formatTimeStr(item.time)}
              />
              {isAppointment && item.location ? (
                <DetailRow
                  icon={<Bell width={18} height={18} color="#6B7280" />}
                  label="Location"
                  value={item.location}
                />
              ) : null}
              <DetailRow
                icon={<Clock width={18} height={18} color="#6B7280" />}
                label="Repeat"
                value={item.rrule}
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
          {item.notes ? (
            <View>
              <Text className="text-sm font-bold mb-2" style={{color: accentColor}}>
                Notes
              </Text>
              <View className="bg-white rounded-2xl px-4 py-4">
                <Text className="text-gray-600 text-sm">{item.notes}</Text>
              </View>
            </View>
          ) : null}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
