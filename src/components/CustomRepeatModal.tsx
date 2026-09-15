import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
} from 'react-native';

interface CustomRepeatModalProps {
  visible: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}

const FREQUENCY_UNITS = ['Day', 'Week', 'Month'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_OF_MONTH = ['1st', '2nd', '3rd', '4th', 'Last'];
const END_OPTIONS = ['Never', 'On date', 'After occurrences'];

export default function CustomRepeatModal({visible, onSave, onClose}: CustomRepeatModalProps) {
  const [every, setEvery] = useState('1');
  const [unit, setUnit] = useState('Week');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthType, setMonthType] = useState<'day-of-month' | 'day-of-week'>('day-of-month');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [weekOfMonth, setWeekOfMonth] = useState('1st');
  const [dayOfWeek, setDayOfWeek] = useState('Mon');
  const [endOption, setEndOption] = useState('Never');
  const [endDate, setEndDate] = useState('');
  const [occurrences, setOccurrences] = useState('');

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  };

  const handleSave = () => {
    let label = `Every ${every} ${unit}${parseInt(every) > 1 ? 's' : ''}`;

    if (unit === 'Week' && selectedDays.length > 0) {
      label += ` on ${selectedDays.join(', ')}`;
    }

    if (unit === 'Month') {
      if (monthType === 'day-of-week') {
        label += `, ${weekOfMonth} ${dayOfWeek}`;
      } else {
        label += `, day ${dayOfMonth} of month`;
      }
    }

    if (endOption === 'On date' && endDate) label += `, until ${endDate}`;
    if (endOption === 'After occurrences' && occurrences) label += `, ${occurrences}x`;

    onSave(label);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24}}>
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-2xl w-full p-5">
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-gray-800 text-base font-bold">Custom Repeat</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Text className="text-gray-400 text-lg font-bold">✕</Text>
                  </TouchableOpacity>
                </View>

                <View className="h-px bg-gray-100 mb-4" />

                {/* Frequency */}
                <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Frequency</Text>
                <View className="flex-row items-center gap-3 mb-4">
                  <Text className="text-gray-700 text-sm">Every</Text>
                  <TextInput
                    value={every}
                    onChangeText={setEvery}
                    keyboardType="numeric"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-gray-800 text-sm w-14 text-center"
                  />
                  <View className="flex-row gap-2">
                    {FREQUENCY_UNITS.map(u => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => { setUnit(u); setSelectedDays([]); }}
                        className={`px-3 py-2 rounded-xl border ${unit === u ? 'bg-teal-500 border-teal-500' : 'border-gray-200'}`}>
                        <Text className={`text-sm ${unit === u ? 'text-white font-medium' : 'text-gray-600'}`}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Repeat on Days (Week) */}
                {unit === 'Week' && (
                  <View className="mb-4">
                    <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Repeat on</Text>
                    <View className="flex-row gap-1">
                      {DAYS.map(day => (
                        <TouchableOpacity
                          key={day}
                          onPress={() => toggleDay(day)}
                          className={`flex-1 py-2 rounded-xl items-center border ${selectedDays.includes(day) ? 'bg-teal-500 border-teal-500' : 'border-gray-200'}`}>
                          <Text className={`text-xs font-medium ${selectedDays.includes(day) ? 'text-white' : 'text-gray-600'}`}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Repeat on (Month) */}
                {unit === 'Month' && (
                  <View className="mb-4">
                    <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Repeat on</Text>

                    {/* Day of month */}
                    <TouchableOpacity
                      onPress={() => setMonthType('day-of-month')}
                      className="flex-row items-center gap-3 py-2">
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${monthType === 'day-of-month' ? 'border-teal-500' : 'border-gray-300'}`}>
                        {monthType === 'day-of-month' && <View className="w-3 h-3 rounded-full bg-teal-500" />}
                      </View>
                      <Text className="text-gray-700 text-sm">Day of month</Text>
                    </TouchableOpacity>

                    {/* Day of month number grid */}
                    {monthType === 'day-of-month' && (
                      <View className="flex-row flex-wrap gap-1 ml-9 mb-2">
                        {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                          <TouchableOpacity
                            key={d}
                            onPress={() => setDayOfMonth(d)}
                            className={`w-8 h-8 rounded-xl items-center justify-center border ${dayOfMonth === d ? 'bg-teal-500 border-teal-500' : 'border-gray-200'}`}>
                            <Text className={`text-xs font-medium ${dayOfMonth === d ? 'text-white' : 'text-gray-600'}`}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Day of week */}
                    <TouchableOpacity
                      onPress={() => setMonthType('day-of-week')}
                      className="flex-row items-center gap-3 py-2 mb-2">
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${monthType === 'day-of-week' ? 'border-teal-500' : 'border-gray-300'}`}>
                        {monthType === 'day-of-week' && <View className="w-3 h-3 rounded-full bg-teal-500" />}
                      </View>
                      <Text className="text-gray-700 text-sm">Day of week</Text>
                    </TouchableOpacity>

                    {/* Week of month + day selector */}
                    {monthType === 'day-of-week' && (
                      <View className="ml-9 gap-3">
                        {/* Week of month pills */}
                        <View className="flex-row flex-wrap gap-2">
                          {WEEK_OF_MONTH.map(w => (
                            <TouchableOpacity
                              key={w}
                              onPress={() => setWeekOfMonth(w)}
                              className={`px-3 py-1.5 rounded-xl border ${weekOfMonth === w ? 'bg-teal-500 border-teal-500' : 'border-gray-200'}`}>
                              <Text className={`text-xs font-medium ${weekOfMonth === w ? 'text-white' : 'text-gray-600'}`}>{w}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {/* Day of week pills */}
                        <View className="flex-row gap-1">
                          {DAYS.map(day => (
                            <TouchableOpacity
                              key={day}
                              onPress={() => setDayOfWeek(day)}
                              className={`flex-1 py-2 rounded-xl items-center border ${dayOfWeek === day ? 'bg-teal-500 border-teal-500' : 'border-gray-200'}`}>
                              <Text className={`text-xs font-medium ${dayOfWeek === day ? 'text-white' : 'text-gray-600'}`}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Ends */}
                <View className="h-px bg-gray-100 mb-4" />
                <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">Ends</Text>
                {END_OPTIONS.map(option => (
                  <View key={option}>
                    <TouchableOpacity
                      onPress={() => setEndOption(option)}
                      className="flex-row items-center gap-3 py-2">
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${endOption === option ? 'border-teal-500' : 'border-gray-300'}`}>
                        {endOption === option && <View className="w-3 h-3 rounded-full bg-teal-500" />}
                      </View>
                      <Text className="text-gray-700 text-sm">{option}</Text>
                    </TouchableOpacity>

                    {option === 'On date' && endOption === 'On date' && (
                      <TextInput
                        value={endDate}
                        onChangeText={setEndDate}
                        placeholder="MM/DD/YYYY"
                        placeholderTextColor="#9ca3af"
                        className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 text-sm ml-9 mb-1"
                      />
                    )}

                    {option === 'After occurrences' && endOption === 'After occurrences' && (
                      <View className="flex-row items-center gap-2 ml-9 mb-1">
                        <TextInput
                          value={occurrences}
                          onChangeText={setOccurrences}
                          keyboardType="numeric"
                          placeholder="e.g. 10"
                          placeholderTextColor="#9ca3af"
                          className="border border-gray-200 rounded-xl px-4 py-2 text-gray-800 text-sm w-24"
                        />
                        <Text className="text-gray-500 text-sm">occurrences</Text>
                      </View>
                    )}
                  </View>
                ))}

                <View className="h-px bg-gray-100 mt-3 mb-4" />

                <TouchableOpacity onPress={handleSave} className="bg-teal-500 rounded-2xl py-4 items-center">
                  <Text className="text-white font-semibold text-base">Save</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
