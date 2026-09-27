import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {addTask, updateTask} from '../database/services';
import {database} from '../database';
import Task from '../database/models/Task';
import {ScheduleStackParamList} from '../navigation/ScheduleStackNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import RadioSelectModal from '../components/RadioSelectModal';
import CustomRepeatModal from '../components/CustomRepeatModal';
import Calendar from '../assets/svg_icons/calendar.svg';
import Clock from '../assets/svg_icons/clock.svg';

const SIMPLE_REPEAT_OPTIONS = ['Does not repeat', 'Every day', 'Every week', 'Every month', 'Custom'];
const REMINDER_OPTIONS = ['At time of event', '5 mins before', '15 mins before', '30 mins before', '1 hour before'];

type RouteProps = RouteProp<ScheduleStackParamList, 'AddSchedule'>;

// ─── RRULE ↔ UI helpers ───────────────────────────────────────────────────────

/** Build a simple RRULE from the non-custom picker options */
function simpleRepeatToRRule(label: string): string {
  switch (label) {
    case 'Every day':   return 'FREQ=DAILY';
    case 'Every week':  return 'FREQ=WEEKLY';
    case 'Every month': return 'FREQ=MONTHLY';
    default:            return 'FREQ=DAILY;COUNT=1'; // "Does not repeat"
  }
}

/** Derive a human-readable label from any stored RRULE string */
function rruleToDisplayLabel(rrule: string): string {
  if (!rrule) return 'Does not repeat';
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });

  if (parts['COUNT'] === '1') return 'Does not repeat';

  const BYDAY_MAP: Record<string, string> = {
    SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
  };
  const NUM_TO_WEEK: Record<string, string> = {
    '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'Last',
  };

  const freq = parts['FREQ'] ?? '';
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1;

  let base = '';
  if (freq === 'DAILY') {
    base = interval === 1 ? 'Every Day' : `Every ${interval} Days`;
  } else if (freq === 'WEEKLY') {
    base = interval === 1 ? 'Every Week' : `Every ${interval} Weeks`;
    if (parts['BYDAY']) {
      // check for positional (monthly) vs plain weekly days
      const isPositional = /^-?\d+[A-Z]{2}$/.test(parts['BYDAY']);
      if (!isPositional) {
        const days = parts['BYDAY'].split(',').map(d => BYDAY_MAP[d.trim()] ?? d).join(', ');
        base += ` on ${days}`;
      }
    }
  } else if (freq === 'MONTHLY') {
    base = interval === 1 ? 'Every Month' : `Every ${interval} Months`;
    if (parts['BYMONTHDAY']) {
      base += ` on day ${parts['BYMONTHDAY']}`;
    } else if (parts['BYDAY']) {
      const match = parts['BYDAY'].match(/^(-?\d+)([A-Z]{2})$/);
      if (match) {
        base = `Every ${NUM_TO_WEEK[match[1]] ?? ''} ${BYDAY_MAP[match[2]] ?? ''}`;
        if (interval > 1) base += ` (every ${interval} months)`;
      }
    }
  } else {
    return 'Custom';
  }

  // ends suffix
  if (parts['UNTIL']) {
    const y = parts['UNTIL'].slice(0, 4);
    const mo = parseInt(parts['UNTIL'].slice(4, 6));
    const dy = parseInt(parts['UNTIL'].slice(6, 8));
    base += ` until ${mo}/${dy}/${y}`;
  } else if (parts['COUNT'] && parts['COUNT'] !== '1') {
    base += ` · ${parts['COUNT']} times`;
  }

  return base;
}

/** Decide if a stored RRULE came from the simple picker or the custom modal */
function rruleIsCustom(rrule: string): boolean {
  if (!rrule) return false;
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  if (parts['COUNT'] === '1') return false;
  // custom if it has INTERVAL > 1, BYDAY with positional, or BYMONTHDAY
  if (parts['INTERVAL'] && parts['INTERVAL'] !== '1') return true;
  if (parts['BYMONTHDAY']) return true;
  if (parts['BYDAY']) {
    // positional BYDAY = custom monthly
    if (/^-?\d+[A-Z]{2}$/.test(parts['BYDAY'])) return true;
  }
  return false;
}

/** Convert "HH:MM" to a Date for the time picker */
function timeStrToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AddScheduleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const {type, id} = route.params;
  const isEditMode = !!id;
  const isAppointment = type === 'appointment';

  const [loading, setLoading] = useState(isEditMode);
  const [existingTask, setExistingTask] = useState<Task | null>(null);

  // ── form state ──
  const [name, setName] = useState('');
  const [doctorClinic, setDoctorClinic] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState('1 hour before');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());

  // rrule is the source of truth for repeat — display label is derived
  const [rrule, setRrule] = useState('FREQ=DAILY;COUNT=1');
  // which simple option is selected in the RadioSelectModal (or 'Custom')
  const [simpleRepeat, setSimpleRepeat] = useState('Does not repeat');

  // ── picker visibility ──
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // ── validation ──
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── load existing task in edit mode ──
  useEffect(() => {
    if (!isEditMode) return;
    database.get<Task>('tasks').find(id!)
      .then(task => {
        setExistingTask(task);
        setName(task.title);
        setDoctorClinic(task.doctorClinic ?? '');
        setLocation(task.location ?? '');
        setNotes(task.notes ?? '');
        setReminder(task.reminder ?? '1 hour before');
        setDate(new Date(task.startDate));
        setTime(timeStrToDate(task.time));
        setRrule(task.rrule);
        // set the simple picker selection so RadioSelectModal shows correct value
        const isCustom = rruleIsCustom(task.rrule);
        if (isCustom) {
          setSimpleRepeat('Custom');
        } else {
          const label = rruleToDisplayLabel(task.rrule);
          const match = SIMPLE_REPEAT_OPTIONS.find(o => o.toLowerCase() === label.toLowerCase());
          setSimpleRepeat(match ?? 'Does not repeat');
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Could not load item. Please try again.');
        navigation.goBack();
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── derived ──
  const formattedDate = date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
  const formattedTime = time.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
  const timeString = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
  const repeatDisplayLabel = rruleToDisplayLabel(rrule);

  // ── validation ──
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = `${isAppointment ? 'Appointment' : 'Reminder'} name is required.`;
    if (isAppointment && !doctorClinic.trim()) e.doctorClinic = 'Doctor / Clinic is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors(prev => {
      const next = {...prev};
      delete next[field];
      return next;
    });
  };

  // ── repeat handlers ──
  const handleSimpleRepeatSave = (value: string) => {
    setSimpleRepeat(value);
    if (value === 'Custom') {
      // open the custom modal; rrule stays as-is until custom modal saves
      setShowCustomRepeat(true);
    } else {
      setRrule(simpleRepeatToRRule(value));
    }
  };

  const handleCustomRepeatSave = (customRrule: string, _displayLabel: string) => {
    setRrule(customRrule);
    setSimpleRepeat('Custom');
  };

  // ── save ──
  const handleSave = async () => {
    if (!validate()) return;

    // derive endsType from rrule for storage
    const parts: Record<string, string> = {};
    rrule.split(';').forEach(seg => {
      const [k, v] = seg.split('=');
      if (k && v !== undefined) parts[k.trim()] = v.trim();
    });
    const endsType = parts['UNTIL']
      ? 'on_date'
      : parts['COUNT'] && parts['COUNT'] !== '1'
      ? 'after_occurrences'
      : 'never';

    try {
      if (isEditMode && existingTask) {
        await updateTask(existingTask, {
          title: name.trim(),
          startDate: date,
          time: timeString,
          rrule,
          endsType,
          reminder,
          notes,
          doctorClinic,
          location,
        });
      } else {
        await addTask({
          title: name.trim(),
          type,
          startDate: date,
          time: timeString,
          rrule,
          endsType,
          reminder,
          notes,
          doctorClinic,
          location,
        });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  const screenTitle = isEditMode
    ? isAppointment ? 'Edit Appointment' : 'Edit Reminder'
    : isAppointment ? 'Add Appointment' : 'Add Reminder';

  const saveLabel = isEditMode ? 'Save Changes'
    : isAppointment ? 'Save Appointment' : 'Save Reminder';

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#14B8A6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          {screenTitle}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4">

        {/* Name */}
        <Text className="text-gray-700 text-sm font-medium mb-2">
          {isAppointment ? 'Appointment Name' : 'Reminder Name'} <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={name}
          onChangeText={v => { setName(v); clearError('name'); }}
          placeholder="Enter event name"
          placeholderTextColor="#9ca3af"
          className={`border rounded-xl px-4 py-3 text-gray-800 text-sm mb-1 ${
            errors.name ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        {errors.name
          ? <Text className="text-red-400 text-xs mb-3">{errors.name}</Text>
          : <View className="mb-4" />
        }

        {/* Doctor / Clinic */}
        {isAppointment && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-2">
              Doctor / Clinic <Text className="text-red-400">*</Text>
            </Text>
            <TextInput
              value={doctorClinic}
              onChangeText={v => { setDoctorClinic(v); clearError('doctorClinic'); }}
              placeholder="Enter doctor or clinic name"
              placeholderTextColor="#9ca3af"
              className={`border rounded-xl px-4 py-3 text-gray-800 text-sm mb-1 ${
                errors.doctorClinic ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.doctorClinic
              ? <Text className="text-red-400 text-xs mb-3">{errors.doctorClinic}</Text>
              : <View className="mb-4" />
            }
          </>
        )}

        {/* Date & Time */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-2">Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl px-4 py-3">
              <Calendar width={20} height={20} color="black" />
              <Text className="text-gray-600 text-sm">{formattedDate}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-2">Time</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="flex-row items-center gap-x-2 border border-gray-200 rounded-xl px-4 py-3">
              <Clock width={20} height={20} color="black" />
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
              placeholder="Enter location"
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
          {/* show the derived human-readable label, not the raw RRULE */}
          <Text className="text-gray-600 text-sm flex-1 mr-2" numberOfLines={1}>
            {repeatDisplayLabel}
          </Text>
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
        <TouchableOpacity
          onPress={handleSave}
          className="bg-teal-500 rounded-2xl py-4 items-center mb-8"
          style={{opacity: Object.keys(errors).length > 0 ? 0.6 : 1}}>
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

      {/* Simple Repeat Modal */}
      <RadioSelectModal
        visible={showRepeatModal}
        title="Repeat"
        options={SIMPLE_REPEAT_OPTIONS}
        selected={simpleRepeat}
        onSave={handleSimpleRepeatSave}
        onClose={() => setShowRepeatModal(false)}
      />

      {/* Custom Repeat Modal */}
      <CustomRepeatModal
        visible={showCustomRepeat}
        initialRrule={simpleRepeat === 'Custom' ? rrule : undefined}
        onSave={handleCustomRepeatSave}
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
