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
import {addTask, updateTask, upsertOccurrence, deleteThisAndFollowing} from '../database/services';
import {rescheduleAllNotifications} from '../notifications/notificationService';
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

// Accept both AddSchedule and EditSchedule route shapes
type AddRouteProps = RouteProp<ScheduleStackParamList, 'AddSchedule'>;
type EditRouteProps = RouteProp<ScheduleStackParamList, 'EditSchedule'>;
type RouteProps = AddRouteProps | EditRouteProps;

// ─── RRULE ↔ UI helpers ───────────────────────────────────────────────────────

function simpleRepeatToRRule(label: string): string {
  switch (label) {
    case 'Every day':   return 'FREQ=DAILY';
    case 'Every week':  return 'FREQ=WEEKLY';
    case 'Every month': return 'FREQ=MONTHLY';
    default:            return 'FREQ=DAILY;COUNT=1';
  }
}

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

function rruleIsCustom(rrule: string): boolean {
  if (!rrule) return false;
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  if (parts['COUNT'] === '1') return false;
  if (parts['INTERVAL'] && parts['INTERVAL'] !== '1') return true;
  if (parts['BYMONTHDAY']) return true;
  if (parts['BYDAY'] && /^-?\d+[A-Z]{2}$/.test(parts['BYDAY'])) return true;
  return false;
}

function timeStrToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function deriveEndsType(rrule: string): string {
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  if (parts['UNTIL']) return 'on_date';
  if (parts['COUNT'] && parts['COUNT'] !== '1') return 'after_occurrences';
  return 'never';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AddScheduleScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const params = route.params as any;

  const type: 'reminder' | 'appointment' = params.type;
  const id: string | undefined = params.id;
  const editScope: 'this' | 'this_and_following' | 'all' | undefined = params.editScope;
  const occurrenceDate: string | undefined = params.occurrenceDate;
  const occurrenceTime: string | undefined = params.occurrenceTime;

  const isEditMode = !!id;
  const isAppointment = type === 'appointment';
  // single-occurrence edit — hides repeat picker, saves to occurrences table
  const isSingleEdit = editScope === 'this';

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
  const [rrule, setRrule] = useState('FREQ=DAILY;COUNT=1');
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
        // for single-occurrence edit, pre-fill date/time from the occurrence
        if (isSingleEdit && occurrenceDate) {
          setDate(new Date(occurrenceDate));
        } else {
          setDate(new Date(task.startDate));
        }
        const preloadTime = (isSingleEdit && occurrenceTime) ? occurrenceTime : task.time;
        setTime(timeStrToDate(preloadTime));
        setRrule(task.rrule);
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

  const handleSimpleRepeatSave = (value: string) => {
    setSimpleRepeat(value);
    if (value === 'Custom') {
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

    try {
      // ── scope: this event only ──
      // Save overrides to the occurrences table; task rule is untouched
      if (isSingleEdit && existingTask && occurrenceDate && occurrenceTime) {
        await upsertOccurrence(
          existingTask.id,
          'task',
          new Date(occurrenceDate),
          occurrenceTime,
          {
            timeOverride: timeString !== occurrenceTime ? timeString : '',
            titleOverride: name.trim() !== existingTask.title ? name.trim() : '',
            notesOverride: notes !== existingTask.notes ? notes : '',
          },
        );
        await rescheduleAllNotifications();
        navigation.goBack();
        return;
      }

      // ── scope: this and following ──
      // Cut the existing task at the day before this occurrence, then create
      // a new task starting from this occurrence's date with the edited values
      if (editScope === 'this_and_following' && existingTask && occurrenceDate) {
        const occDate = new Date(occurrenceDate);
        // terminate the old series the day before
        await deleteThisAndFollowing(existingTask, occDate);
        // create new task from this date onward
        await addTask({
          title: name.trim(),
          type,
          startDate: occDate,
          time: timeString,
          rrule,
          endsType: deriveEndsType(rrule),
          reminder,
          notes,
          doctorClinic,
          location,
        });
        await rescheduleAllNotifications();
        navigation.goBack();
        return;
      }

      // ── scope: all events (or non-repeating edit) ──
      if (isEditMode && existingTask) {
        await updateTask(existingTask, {
          title: name.trim(),
          startDate: date,
          time: timeString,
          rrule,
          endsType: deriveEndsType(rrule),
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
          endsType: deriveEndsType(rrule),
          reminder,
          notes,
          doctorClinic,
          location,
        });
      }
      await rescheduleAllNotifications();
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  // ── screen title ──
  const screenTitle = (() => {
    if (!isEditMode) return isAppointment ? 'Add Appointment' : 'Add Reminder';
    if (isSingleEdit) return isAppointment ? 'Edit This Appointment' : 'Edit This Reminder';
    return isAppointment ? 'Edit Appointment' : 'Edit Reminder';
  })();

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

      {/* Single-occurrence notice */}
      {isSingleEdit && (
        <View className="mx-4 mt-3 px-4 py-2.5 bg-teal-50 rounded-xl border border-teal-200">
          <Text className="text-teal-700 text-xs font-medium">
            Editing this occurrence only — other events in the series won't be affected.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pt-4">

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
        <View className="flex-row gap-x-3">
          {/* Date only shown when not single-edit (date of a single occurrence is fixed) */}
          {!isSingleEdit && (
            <View className="flex-1">
              <Text className="text-gray-700 text-sm font-medium mb-2">Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="flex-row justify-around items-center border border-gray-200 rounded-xl pl-3 pr-6 py-3">
                <Calendar width={20} height={20} color="black" />
                <Text className="text-gray-600 text-sm">{formattedDate}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-gray-700 text-sm font-medium mb-2">Time</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="flex-row justify-around items-center border border-gray-200 rounded-xl pl-3 pr-6 py-3">
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

        {/* Repeat — hidden for single-occurrence edits */}
        {!isSingleEdit && (
          <>
            <Text className="text-gray-700 text-sm font-medium mb-2">Repeat</Text>
            <TouchableOpacity
              onPress={() => setShowRepeatModal(true)}
              className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-gray-600 text-sm flex-1 mr-2" numberOfLines={1}>
                {repeatDisplayLabel}
              </Text>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          </>
        )}

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

      </View>
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
