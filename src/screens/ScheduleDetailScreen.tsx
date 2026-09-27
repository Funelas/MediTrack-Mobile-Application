import React, {useState, useCallback} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ScheduleStackParamList} from '../navigation/ScheduleStackNavigator';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Clock from '../assets/svg_icons/clock.svg';
import {database} from '../database';
import Task from '../database/models/Task';
import DeleteScheduleModal, {DeleteScope} from '../components/DeleteScheduleModal';
import EditScopeModal, {EditScope} from '../components/EditScopeModal';
import {
  deleteThisOccurrence,
  deleteThisAndFollowing,
  deleteAllEvents,
} from '../database/services';

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

function formatTimeStr(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
}

function rruleToLabel(rrule: string): string {
  if (!rrule) return '—';
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  const freq = parts['FREQ'] ?? '';
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1;
  if (parts['COUNT'] === '1') return 'Does not repeat';
  const BYDAY_MAP: Record<string, string> = {
    SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
  };
  const NUM_TO_WEEK: Record<string, string> = {
    '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'Last',
  };
  let base = '';
  if (freq === 'DAILY') {
    base = interval === 1 ? 'Every Day' : `Every ${interval} Days`;
  } else if (freq === 'WEEKLY') {
    if (parts['BYDAY']) {
      const match = parts['BYDAY'].match(/^(-?\d+)([A-Z]{2})$/);
      if (match) {
        // positional monthly BYDAY e.g. "2MO"
        base = `Every ${NUM_TO_WEEK[match[1]] ?? ''} ${BYDAY_MAP[match[2]] ?? ''}`;
        if (interval > 1) base += ` (every ${interval} months)`;
      } else {
        const days = parts['BYDAY'].split(',').map(d => BYDAY_MAP[d.trim()] ?? d).join(', ');
        base = interval === 1 ? `Every Week on ${days}` : `Every ${interval} Weeks on ${days}`;
      }
    } else {
      base = interval === 1 ? 'Every Week' : `Every ${interval} Weeks`;
    }
  } else if (freq === 'MONTHLY') {
    if (parts['BYMONTHDAY']) {
      base = interval === 1
        ? `Every Month on day ${parts['BYMONTHDAY']}`
        : `Every ${interval} Months on day ${parts['BYMONTHDAY']}`;
    } else {
      base = interval === 1 ? 'Every Month' : `Every ${interval} Months`;
    }
  } else {
    base = rrule;
  }
  if (parts['UNTIL']) {
    const y = parseInt(parts['UNTIL'].slice(0, 4));
    const mo = parseInt(parts['UNTIL'].slice(4, 6)) - 1;
    const dy = parseInt(parts['UNTIL'].slice(6, 8));
    base += ` until ${new Date(y, mo, dy).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`;
  } else if (parts['COUNT'] && parts['COUNT'] !== '1') {
    base += ` · ${parts['COUNT']} times`;
  }
  return base;
}

function isRepeatingTask(rrule: string): boolean {
  if (!rrule) return false;
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  return parts['COUNT'] !== '1';
}

export default function ScheduleDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const [item, setItem] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      database
        .get<Task>('tasks')
        .find(params.id)
        .then(setItem)
        .catch(() => setItem(null))
        .finally(() => setLoading(false));
    }, [params.id]),
  );

  const handleDelete = async (scope: DeleteScope) => {
    if (!item) return;
    setShowDeleteModal(false);

    try {
      // Resolve the occurrence date — use the passed param if available,
      // otherwise fall back to the task's startDate
      const occDate = params.occurrenceDate
        ? new Date(params.occurrenceDate)
        : new Date(item.startDate);
      const occTime = params.occurrenceTime ?? item.time;

      switch (scope) {
        case 'this':
          await deleteThisOccurrence(item, occDate, occTime);
          navigation.goBack();
          break;
        case 'this_and_following':
          await deleteThisAndFollowing(item, occDate);
          navigation.goBack();
          break;
        case 'all':
          await deleteAllEvents(item);
          navigation.goBack();
          break;
      }
    } catch {
      Alert.alert('Error', 'Could not delete the event. Please try again.');
    }
  };

  const handleEditScope = (scope: EditScope) => {
    if (!item) return;
    setShowEditModal(false);
    navigation.navigate('EditSchedule', {
      id: item.id,
      type: item.type as 'reminder' | 'appointment',
      editScope: scope,
      occurrenceDate: params.occurrenceDate ?? new Date(item.startDate).toISOString(),
      occurrenceTime: params.occurrenceTime ?? item.time,
    });
  };

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
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const repeating = isRepeatingTask(item.rrule);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-10 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-gray-800 text-base font-semibold">{headerTitle}</Text>
        <View className="flex-row items-center gap-1">
          {/* Delete */}
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            className="p-2">
            <Text className="text-red-500 text-sm font-semibold">Delete</Text>
          </TouchableOpacity>
          {/* Edit */}
          <TouchableOpacity
            onPress={() => repeating ? setShowEditModal(true) : handleEditScope('all')}
            className="p-2">
            <Text className="text-teal-500 text-sm font-semibold">Edit</Text>
          </TouchableOpacity>
        </View>
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
              {isAppointment && item.doctorClinic
                ? <Text className="text-gray-400 text-sm mt-0.5">{item.doctorClinic}</Text>
                : null}
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
              {isAppointment && item.location
                ? <DetailRow
                    icon={<Bell width={18} height={18} color="#6B7280" />}
                    label="Location"
                    value={item.location}
                  />
                : null}
              <DetailRow
                icon={<Clock width={18} height={18} color="#6B7280" />}
                label="Repeat"
                value={rruleToLabel(item.rrule)}
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
              <Text className="text-sm font-bold mb-2" style={{color: accentColor}}>Notes</Text>
              <View className="bg-white rounded-2xl px-4 py-4">
                <Text className="text-gray-600 text-sm">{item.notes}</Text>
              </View>
            </View>
          ) : null}

        </View>
      </ScrollView>

      {/* Delete modal */}
      <DeleteScheduleModal
        visible={showDeleteModal}
        isRepeating={repeating}
        title={item.title}
        onDelete={handleDelete}
        onClose={() => setShowDeleteModal(false)}
      />

      {/* Edit scope modal */}
      <EditScopeModal
        visible={showEditModal}
        isRepeating={repeating}
        title={item.title}
        onSelect={handleEditScope}
        onClose={() => setShowEditModal(false)}
      />
    </SafeAreaView>
  );
}
