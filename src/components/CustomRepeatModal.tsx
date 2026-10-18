import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface CustomRepeatModalProps {
  visible: boolean;
  onSave: (rrule: string, displayLabel: string) => void;
  onClose: () => void;
  initialRrule?: string;
}

const UNITS = ['Day', 'Week', 'Month'];
// Single-letter labels for the day pills
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_KEYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_OF_MONTH = ['1st', '2nd', '3rd', '4th', 'Last'];

const UI_TO_BYDAY: Record<string, string> = {
  Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA',
};
const BYDAY_TO_UI: Record<string, string> = {
  SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
};
const WEEK_TO_NUM: Record<string, string> = {
  '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', 'Last': '-1',
};
const NUM_TO_WEEK: Record<string, string> = {
  '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'Last',
};

export default function CustomRepeatModal({
  visible,
  onSave,
  onClose,
  initialRrule,
}: CustomRepeatModalProps) {
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthType, setMonthType] = useState<'day-of-month' | 'day-of-week'>('day-of-month');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [weekOfMonth, setWeekOfMonth] = useState('1st');
  const [dayOfWeek, setDayOfWeek] = useState('Mon');
  const [endOption, setEndOption] = useState<'Never' | 'On date' | 'After'>('Never');
  const [endDate, setEndDate] = useState(new Date());
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [occurrences, setOccurrences] = useState('10');

  // ── Pre-populate from existing RRULE ──────────────────────────────────────
  useEffect(() => {
    if (!visible || !initialRrule) return;
    const parts: Record<string, string> = {};
    initialRrule.split(';').forEach(seg => {
      const [k, v] = seg.split('=');
      if (k && v !== undefined) parts[k.trim()] = v.trim();
    });

    const freq = parts['FREQ'] ?? 'WEEKLY';
    setInterval(parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1);

    if (freq === 'DAILY') {
      setUnit('Day');
    } else if (freq === 'WEEKLY') {
      setUnit('Week');
      if (parts['BYDAY'] && !/^-?\d/.test(parts['BYDAY'])) {
        setSelectedDays(parts['BYDAY'].split(',').map(d => BYDAY_TO_UI[d.trim()] ?? d));
      }
    } else if (freq === 'MONTHLY') {
      setUnit('Month');
      if (parts['BYMONTHDAY']) {
        setMonthType('day-of-month');
        setDayOfMonth(parseInt(parts['BYMONTHDAY']) || 1);
      } else if (parts['BYDAY']) {
        setMonthType('day-of-week');
        const match = parts['BYDAY'].match(/^(-?\d+)([A-Z]{2})$/);
        if (match) {
          setWeekOfMonth(NUM_TO_WEEK[match[1]] ?? '1st');
          setDayOfWeek(BYDAY_TO_UI[match[2]] ?? 'Mon');
        }
      }
    }

    if (parts['UNTIL']) {
      setEndOption('On date');
      const u = parts['UNTIL'];
      setEndDate(new Date(
        parseInt(u.slice(0, 4)),
        parseInt(u.slice(4, 6)) - 1,
        parseInt(u.slice(6, 8)),
      ));
    } else if (parts['COUNT'] && parts['COUNT'] !== '1') {
      setEndOption('After');
      setOccurrences(parts['COUNT']);
    } else {
      setEndOption('Never');
    }
  }, [visible, initialRrule]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleDay = (key: string) => {
    setSelectedDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key],
    );
  };

  const unitLabel = (u: string, n: number) =>
    n === 1 ? u : `${u}s`;

  const formattedEndDate = endDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // ── Build RRULE + label on save ───────────────────────────────────────────
  const handleSave = () => {
    let rrule = '';
    let label = '';

    if (unit === 'Day') {
      rrule = interval === 1 ? 'FREQ=DAILY' : `FREQ=DAILY;INTERVAL=${interval}`;
      label = interval === 1 ? 'Every Day' : `Every ${interval} Days`;

    } else if (unit === 'Week') {
      rrule = interval === 1 ? 'FREQ=WEEKLY' : `FREQ=WEEKLY;INTERVAL=${interval}`;
      const byDay = selectedDays.map(d => UI_TO_BYDAY[d] ?? d).join(',');
      if (byDay) rrule += `;BYDAY=${byDay}`;
      label = interval === 1 ? 'Every Week' : `Every ${interval} Weeks`;
      if (selectedDays.length > 0) label += ` on ${selectedDays.join(', ')}`;

    } else {
      rrule = interval === 1 ? 'FREQ=MONTHLY' : `FREQ=MONTHLY;INTERVAL=${interval}`;
      if (monthType === 'day-of-month') {
        rrule += `;BYMONTHDAY=${dayOfMonth}`;
        label = `Every ${interval === 1 ? 'Month' : `${interval} Months`} on day ${dayOfMonth}`;
      } else {
        const num = WEEK_TO_NUM[weekOfMonth] ?? '1';
        rrule += `;BYDAY=${num}${UI_TO_BYDAY[dayOfWeek] ?? 'MO'}`;
        label = `Every ${weekOfMonth} ${dayOfWeek}${interval > 1 ? ` (${interval} months)` : ''}`;
      }
    }

    if (endOption === 'On date') {
      const y = endDate.getFullYear();
      const mo = String(endDate.getMonth() + 1).padStart(2, '0');
      const dy = String(endDate.getDate()).padStart(2, '0');
      rrule += `;UNTIL=${y}${mo}${dy}`;
      label += ` until ${formattedEndDate}`;
    } else if (endOption === 'After') {
      const count = parseInt(occurrences) || 1;
      rrule += `;COUNT=${count}`;
      label += ` · ${count} times`;
    }

    onSave(rrule, label);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'}}>
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">

              {/* Handle bar */}
              <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-4" />

              {/* Header */}
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-gray-800 text-base font-bold">Custom repeat</Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Text className="text-gray-400 text-lg">✕</Text>
                </TouchableOpacity>
              </View>

              {/* ── Interval row ── */}
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                Repeat every
              </Text>
              <View className="flex-row items-center gap-3 mb-5">
                {/* Stepper */}
                <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden">
                  <TouchableOpacity
                    onPress={() => setInterval(n => Math.max(1, n - 1))}
                    className="w-10 h-10 items-center justify-center bg-gray-50">
                    <Text className="text-gray-600 text-lg font-semibold">−</Text>
                  </TouchableOpacity>
                  <View className="w-10 h-10 items-center justify-center">
                    <Text className="text-gray-800 text-sm font-bold">{interval}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setInterval(n => n + 1)}
                    className="w-10 h-10 items-center justify-center bg-gray-50">
                    <Text className="text-gray-600 text-lg font-semibold">+</Text>
                  </TouchableOpacity>
                </View>

                {/* Unit pills */}
                <View className="flex-row gap-2 flex-1">
                  {UNITS.map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => { setUnit(u as any); setSelectedDays([]); }}
                      className={`flex-1 py-2.5 rounded-xl items-center border ${
                        unit === u ? 'bg-teal-500 border-teal-500' : 'border-gray-200 bg-white'
                      }`}>
                      <Text className={`text-sm font-medium ${unit === u ? 'text-white' : 'text-gray-600'}`}>
                        {unitLabel(u, interval)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── Weekly day pills ── */}
              {unit === 'Week' && (
                <View className="mb-5">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                    Repeat on
                  </Text>
                  <View className="flex-row gap-1.5">
                    {DAY_KEYS.map((key, i) => (
                      <TouchableOpacity
                        key={`${key}-${i}`}
                        onPress={() => toggleDay(key)}
                        className={`flex-1 aspect-square rounded-full items-center justify-center border ${
                          selectedDays.includes(key)
                            ? 'bg-teal-500 border-teal-500'
                            : 'border-gray-200 bg-white'
                        }`}
                        style={{height: 36}}>
                        <Text className={`text-xs font-semibold ${
                          selectedDays.includes(key) ? 'text-white' : 'text-gray-600'
                        }`}>
                          {DAY_LETTERS[i]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Monthly options ── */}
              {unit === 'Month' && (
                <View className="mb-5">
                  <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                    Repeat on
                  </Text>
                  {/* Day of month */}
                  <TouchableOpacity
                    onPress={() => setMonthType('day-of-month')}
                    className={`flex-row items-center justify-between px-4 py-3 rounded-xl border mb-2 ${
                      monthType === 'day-of-month' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                    }`}>
                    <Text className={`text-sm ${monthType === 'day-of-month' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                      Day of month
                    </Text>
                    {monthType === 'day-of-month' && (
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => setDayOfMonth(d => Math.max(1, d - 1))}
                          className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
                          <Text className="text-white text-sm font-bold">−</Text>
                        </TouchableOpacity>
                        <Text className="text-teal-700 font-bold text-sm w-6 text-center">{dayOfMonth}</Text>
                        <TouchableOpacity
                          onPress={() => setDayOfMonth(d => Math.min(31, d + 1))}
                          className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
                          <Text className="text-white text-sm font-bold">+</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Day of week */}
                  <TouchableOpacity
                    onPress={() => setMonthType('day-of-week')}
                    className={`flex-row items-center justify-between px-4 py-3 rounded-xl border ${
                      monthType === 'day-of-week' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                    }`}>
                    <Text className={`text-sm ${monthType === 'day-of-week' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                      Day of week
                    </Text>
                    {monthType === 'day-of-week' && (
                      <Text className="text-teal-600 text-xs font-medium">
                        {weekOfMonth} {dayOfWeek}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Week + day selectors (expanded when day-of-week selected) */}
                  {monthType === 'day-of-week' && (
                    <View className="mt-3 gap-3">
                      <View className="flex-row gap-1.5 flex-wrap">
                        {WEEK_OF_MONTH.map(w => (
                          <TouchableOpacity
                            key={w}
                            onPress={() => setWeekOfMonth(w)}
                            className={`px-3 py-2 rounded-xl border ${
                              weekOfMonth === w ? 'bg-teal-500 border-teal-500' : 'border-gray-200 bg-white'
                            }`}>
                            <Text className={`text-xs font-medium ${weekOfMonth === w ? 'text-white' : 'text-gray-600'}`}>
                              {w}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View className="flex-row gap-1.5">
                        {DAY_KEYS.map((key, i) => (
                          <TouchableOpacity
                            key={key}
                            onPress={() => setDayOfWeek(key)}
                            className={`flex-1 items-center justify-center rounded-full border ${
                              dayOfWeek === key ? 'bg-teal-500 border-teal-500' : 'border-gray-200 bg-white'
                            }`}
                            style={{height: 36}}>
                            <Text className={`text-xs font-semibold ${dayOfWeek === key ? 'text-white' : 'text-gray-600'}`}>
                              {DAY_LETTERS[i]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── Ends ── */}
              <View className="h-px bg-gray-100 mb-4" />
              <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
                Ends
              </Text>

              {/* Never */}
              <TouchableOpacity
                onPress={() => setEndOption('Never')}
                className={`flex-row items-center px-4 py-3 rounded-xl border mb-2 ${
                  endOption === 'Never' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                }`}>
                <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                  endOption === 'Never' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {endOption === 'Never' && <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
                </View>
                <Text className={`text-sm ${endOption === 'Never' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                  Never
                </Text>
              </TouchableOpacity>

              {/* On date */}
              <TouchableOpacity
                onPress={() => setEndOption('On date')}
                className={`flex-row items-center px-4 py-3 rounded-xl border mb-2 ${
                  endOption === 'On date' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                }`}>
                <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                  endOption === 'On date' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {endOption === 'On date' && <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
                </View>
                <Text className={`text-sm flex-1 ${endOption === 'On date' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                  On date
                </Text>
                {endOption === 'On date' && (
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}
                    className="flex-row items-center gap-1 bg-white border border-teal-300 rounded-lg px-3 py-1">
                    <Text className="text-teal-600 text-xs font-medium">{formattedEndDate}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* After N occurrences */}
              <TouchableOpacity
                onPress={() => setEndOption('After')}
                className={`flex-row items-center px-4 py-3 rounded-xl border mb-5 ${
                  endOption === 'After' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'
                }`}>
                <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                  endOption === 'After' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {endOption === 'After' && <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
                </View>
                <Text className={`text-sm ${endOption === 'After' ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>
                  After
                </Text>
                {endOption === 'After' && (
                  <View className="flex-row items-center gap-2 ml-3">
                    <TextInput
                      value={occurrences}
                      onChangeText={setOccurrences}
                      keyboardType="numeric"
                      className="border border-teal-300 rounded-lg px-3 py-1 text-teal-700 text-sm text-center w-14"
                    />
                    <Text className="text-teal-600 text-sm">occurrences</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Done button */}
              <TouchableOpacity
                onPress={handleSave}
                className="bg-teal-500 rounded-2xl py-4 items-center">
                <Text className="text-white font-semibold text-base">Done</Text>
              </TouchableOpacity>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>

      {/* End date native picker */}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowEndDatePicker(false);
            if (selected) setEndDate(selected);
          }}
        />
      )}
    </Modal>
  );
}
