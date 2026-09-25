import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import {useNavigation, useRoute} from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import RadioSelectModal from '../components/RadioSelectModal';
import CustomRepeatModal from '../components/CustomRepeatModal';
import Clock from '../assets/svg_icons/clock.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Stock from '../assets/svg_icons/stock.svg';
import QR from '../assets/svg_icons/qr.svg';
import Tap from '../assets/svg_icons/tap.svg';
const MEDICINE_COLORS = [
  '#1F2937', '#3B82F6', '#8B5CF6', '#F97316',
  '#14B8A6', '#EAB308', '#EF4444', '#EC4899',
];

const FORM_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Inhaler'];
const FORM_UNIT_MAP: Record<string, string> = {
  Tablet: 'Tablet(s)',
  Capsule: 'Capsule(s)',
  Syrup: 'mL',
  Injection: 'mL',
  Drops: 'mL',
  Cream: 'g',
  Inhaler: 'Puff(s)',
};
const REPEAT_OPTIONS = ['Does not repeat', 'Every day', 'Every week', 'Every month', 'Custom'];

// Step Indicator
function StepIndicator({current}: {current: number}) {
  const steps = ['Information', 'Schedule', 'Inventory', 'Tracking'];
  return (
    <View className="flex-row items-center justify-center px-4 py-4">
      {steps.map((label, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <View key={step} className="flex-row items-center">
            <View className="items-center">
              <View className={`w-8 h-8 rounded-full items-center justify-center ${isCompleted || isActive ? 'bg-teal-500' : 'bg-gray-200'}`}>
                {isCompleted ? (
                  <Text className="text-white text-xs font-bold">✓</Text>
                ) : (
                  <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-400'}`}>{step}</Text>
                )}
              </View>
              <Text className={`text-xs mt-1 ${isActive ? 'text-teal-500 font-semibold' : 'text-gray-400'}`}>{label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View className={`h-px w-8 mb-4 mx-1 ${step < current ? 'bg-teal-500' : 'bg-gray-200'}`} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// Step 1
function Step1({data, setData, errors}: {data: any; setData: (d: any) => void; errors: Record<string, boolean>}) {
  const [showFormDropdown, setShowFormDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(data.color);

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <View className="flex-row items-center gap-2 mb-4 mt-2">
        <View className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">1</Text>
        </View>
        <Text className="text-gray-800 font-bold text-base">Medicine Information</Text>
      </View>

      {/* Color Picker */}
      <Text className="text-gray-700 text-sm font-medium mb-1">Medicine Color</Text>
      <Text className="text-gray-400 text-xs mb-3">Choose a theme color of this medicine</Text>
      <View className="flex-row gap-2 mb-4 flex-wrap">
        {MEDICINE_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            onPress={() => setData({...data, color})}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{backgroundColor: color}}>
            {data.color === color && <Text className="text-white text-sm font-bold">✓</Text>}
          </TouchableOpacity>
        ))}
        {/* Custom color swatch if user picked one */}
        {!MEDICINE_COLORS.includes(data.color) && (
          <TouchableOpacity
            onPress={() => { setTempColor(data.color); setShowColorPicker(true); }}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{backgroundColor: data.color}}>
            <Text className="text-white text-sm font-bold">✓</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => { setTempColor(data.color); setShowColorPicker(true); }}
          className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 items-center justify-center">
          <Text className="text-gray-400 text-lg">+</Text>
        </TouchableOpacity>
      </View>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
          style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <Text className="text-gray-800 font-bold text-base mb-4">Custom Color</Text>

            {/* Preview */}
            <View className="flex-row items-center gap-3 mb-4">
              <View className="w-10 h-10 rounded-full" style={{backgroundColor: tempColor}} />
              <View className="flex-1 flex-row items-center border border-gray-200 rounded-xl px-3 py-2">
                <Text className="text-gray-400 text-sm mr-1">#</Text>
                <TextInput
                  value={tempColor.replace('#', '')}
                  onChangeText={v => {
                    const hex = '#' + v.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                    setTempColor(hex);
                  }}
                  placeholder="e.g. 14B8A6"
                  placeholderTextColor="#9ca3af"
                  maxLength={6}
                  autoCapitalize="characters"
                  className="flex-1 text-gray-800 text-sm"
                />
              </View>
            </View>

            {/* Wheel */}
            <View style={{height: 280}}>
              <ColorPicker
                color={tempColor}
                onColorChangeComplete={setTempColor}
                thumbSize={28}
                sliderSize={28}
                noSnap={true}
                swatches={false}
              />
            </View>

            {/* Actions */}
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setShowColorPicker(false)}
                className="flex-1 border border-gray-200 rounded-2xl py-3 items-center">
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setData({...data, color: tempColor}); setShowColorPicker(false); }}
                className="flex-1 rounded-2xl py-3 items-center"
                style={{backgroundColor: tempColor}}>
                <Text className="text-white font-semibold">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Medicine Name */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Medicine Name <Text className="text-red-400">*</Text></Text>
      <TextInput
        value={data.name}
        onChangeText={v => setData({...data, name: v})}
        placeholder="e.g Metformin"
        placeholderTextColor="#9ca3af"
        className={`border rounded-xl px-4 py-3 text-gray-800 text-sm mb-1 ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
      />
      {errors.name && <Text className="text-red-400 text-xs mb-3">Medicine name is required.</Text>}

      {/* Generic Name */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Generic Name <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
      <TextInput
        value={data.genericName}
        onChangeText={v => setData({...data, genericName: v})}
        placeholder="e.g Metformin Hydrochloride"
        placeholderTextColor="#9ca3af"
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
      />

      {/* Manufacturer */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Manufacturer <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
      <TextInput
        value={data.manufacturer}
        onChangeText={v => setData({...data, manufacturer: v})}
        placeholder="e.g Zuelig Pharma"
        placeholderTextColor="#9ca3af"
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
      />

      {/* Strength / Dosage */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Strength / Dosage <Text className="text-red-400">*</Text></Text>
      <TextInput
        value={data.dosage}
        onChangeText={v => setData({...data, dosage: v})}
        placeholder="e.g 500 mg"
        placeholderTextColor="#9ca3af"
        className={`border rounded-xl px-4 py-3 text-gray-800 text-sm mb-1 ${errors.dosage ? 'border-red-400' : 'border-gray-200'}`}
      />
      {errors.dosage && <Text className="text-red-400 text-xs mb-3">Dosage is required.</Text>}

      {/* Form */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Form <Text className="text-red-400">*</Text></Text>
      <TouchableOpacity
        onPress={() => setShowFormDropdown(!showFormDropdown)}
        className="border border-gray-200 rounded-xl px-4 py-3 flex-row justify-between items-center mb-1">
        <Text className={data.form ? 'text-gray-800 text-sm' : 'text-gray-400 text-sm'}>
          {data.form || 'Tablet'}
        </Text>
        <Text className="text-gray-400">{showFormDropdown ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showFormDropdown && (
        <View className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          {FORM_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={opt}
              onPress={() => { setData({...data, form: opt}); setShowFormDropdown(false); }}
              className={`px-4 py-3 ${data.form === opt ? 'bg-teal-50' : 'bg-white'} ${i < FORM_OPTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <Text className={`text-sm ${data.form === opt ? 'text-teal-600 font-medium' : 'text-gray-700'}`}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View className="h-24" />
    </ScrollView>
  );
}

// Step 2
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Step2({data, setData}: {data: any; setData: (d: any) => void}) {
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [activeTimePickerIndex, setActiveTimePickerIndex] = useState<number | null>(null);

  const formattedStartDate = new Date(data.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

  const addTimeSlot = () => {
    setData({...data, intakeTimes: [...data.intakeTimes, new Date()]});
  };

  const removeTimeSlot = (index: number) => {
    const updated = data.intakeTimes.filter((_: any, i: number) => i !== index);
    setData({...data, intakeTimes: updated});
  };

  const updateTimeSlot = (index: number, time: Date) => {
    const updated = [...data.intakeTimes];
    updated[index] = time;
    setData({...data, intakeTimes: updated});
  };

  const toggleDay = (day: string) => {
    const days: string[] = data.repeatDays;
    const updated = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    setData({...data, repeatDays: updated});
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <View className="flex-row items-center gap-2 mb-4 mt-2">
        <View className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">2</Text>
        </View>
        <Text className="text-gray-800 font-bold text-base">Schedule & Reminder</Text>
      </View>

      {/* Start Date */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Start Date</Text>
      <TouchableOpacity
        onPress={() => setShowStartDatePicker(true)}
        className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
        <View className="flex-row items-center gap-x-2">
          <Clock width={20} height={20} color="black" />
          <Text className="text-gray-600 text-sm">{formattedStartDate}</Text>
        </View>
        <Text className="text-gray-400 text-lg">›</Text>
      </TouchableOpacity>

      {/* Time Slots */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Time(s) of Intake</Text>
      {data.intakeTimes.map((time: Date, index: number) => (
        <View key={index} className="flex-row items-center gap-2 mb-2">
          <TouchableOpacity
            onPress={() => setActiveTimePickerIndex(index)}
            className="flex-1 flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
            <View className="flex-row items-center gap-x-2">
              <Clock width={18} height={18} color="black" />
              <Text className="text-gray-600 text-sm">
                {new Date(time).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true})}
              </Text>
            </View>
            <Text className="text-gray-400 text-xs">Tap to change</Text>
          </TouchableOpacity>
          {data.intakeTimes.length > 1 && (
            <TouchableOpacity
              onPress={() => removeTimeSlot(index)}
              className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
              <Text className="text-red-400 text-base font-bold">−</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity
        onPress={addTimeSlot}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#F0FDFA',
          borderRadius: 12,
          paddingVertical: 12,
          marginBottom: 16,
          borderWidth: 1.5,
          borderColor: '#14B8A6',
        }}>
        <Text style={{color: '#14B8A6', fontSize: 18, fontWeight: 'bold', lineHeight: 22}}>+</Text>
        <Text style={{color: '#14B8A6', fontSize: 14, fontWeight: '600'}}>Add Time</Text>
      </TouchableOpacity>

      {/* Repeat */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Repeat</Text>
      <View className="flex-row gap-3 mb-3">
        {(['Every Day', 'Custom'] as const).map(opt => (
          <TouchableOpacity
            key={opt}
            onPress={() => setData({...data, repeatType: opt, repeatDays: []})}
            className={`flex-1 py-3 rounded-xl items-center border-2 ${
              data.repeatType === opt ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-200'
            }`}>
            <Text className={`text-sm font-semibold ${data.repeatType === opt ? 'text-white' : 'text-gray-600'}`}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day Pills for Custom */}
      {data.repeatType === 'Custom' && (
        <View className="flex-row gap-1 mb-4">
          {WEEK_DAYS.map(day => (
            <TouchableOpacity
              key={day}
              onPress={() => toggleDay(day)}
              className={`flex-1 py-2 rounded-xl items-center border ${
                data.repeatDays.includes(day) ? 'bg-teal-500 border-teal-500' : 'border-gray-200 bg-white'
              }`}>
              <Text className={`text-xs font-medium ${
                data.repeatDays.includes(day) ? 'text-white' : 'text-gray-600'
              }`}>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Ends */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Ends</Text>
      <View className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        {(['Never', 'On Date', 'After Occurrences'] as const).map((opt, i, arr) => (
          <View key={opt}>
            <TouchableOpacity
              onPress={() => setData({...data, endsType: opt})}
              className="flex-row items-center gap-3 px-4 py-3">
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                data.endsType === opt ? 'border-teal-500' : 'border-gray-300'
              }`}>
                {data.endsType === opt && <View className="w-2.5 h-2.5 rounded-full bg-teal-500" />}
              </View>
              <Text className="text-gray-700 text-sm">{opt}</Text>
            </TouchableOpacity>
            {opt === 'On Date' && data.endsType === 'On Date' && (
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                className="mx-4 mb-3 flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                <Text className="text-gray-600 text-sm">
                  {data.endDate
                    ? new Date(data.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
                    : 'Pick a date'}
                </Text>
                <Text className="text-gray-400 text-lg">›</Text>
              </TouchableOpacity>
            )}
            {opt === 'After Occurrences' && data.endsType === 'After Occurrences' && (
              <View className="mx-4 mb-3 flex-row items-center gap-3">
                <TextInput
                  value={data.occurrences}
                  onChangeText={v => setData({...data, occurrences: v.replace(/[^0-9]/g, '')})}
                  keyboardType="numeric"
                  placeholder="e.g. 10"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm w-24"
                />
                <Text className="text-gray-500 text-sm">occurrences</Text>
              </View>
            )}
            {i < arr.length - 1 && <View className="h-px bg-gray-100 mx-4" />}
          </View>
        ))}
      </View>

      {/* Reminder Toggle */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Reminder</Text>
      <View className="border border-gray-200 rounded-xl px-4 py-3 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-medium">Medication Reminder</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Get notified at each intake time</Text>
          </View>
          <Switch
            value={data.reminderEnabled}
            onValueChange={v => setData({...data, reminderEnabled: v})}
            trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View className="flex-row items-center gap-3 bg-teal-50 rounded-xl px-4 py-3 mb-4">
        <View className="w-8 h-8 bg-teal-100 rounded-full items-center justify-center">
          <Bell width={20} height={20} color="#068B48" />
        </View>
        <Text className="text-teal-700 text-xs flex-1">You can manage or snooze reminders anytime.</Text>
      </View>

      {/* Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={new Date(data.startDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowStartDatePicker(false);
            if (selected) setData({...data, startDate: selected});
          }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={data.endDate ? new Date(data.endDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowEndDatePicker(false);
            if (selected) setData({...data, endDate: selected});
          }}
        />
      )}
      {activeTimePickerIndex !== null && (
        <DateTimePicker
          value={new Date(data.intakeTimes[activeTimePickerIndex])}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setActiveTimePickerIndex(null);
            if (selected) updateTimeSlot(activeTimePickerIndex, selected);
          }}
        />
      )}

      <View className="h-24" />
    </ScrollView>
  );
}

// Step 3
function Step3({data, setData, unit, errors}: {data: any; setData: (d: any) => void; unit: string; errors: Record<string, boolean>}) {
  const current = parseFloat(data.currentStock);
  const max = parseFloat(data.maxStock);
  const threshold = parseFloat(data.lowStockThreshold);
  const stockExceedsMax = !isNaN(current) && !isNaN(max) && max > 0 && current > max;
  const thresholdExceedsMax = data.lowStockAlert && !isNaN(threshold) && !isNaN(max) && max > 0 && threshold > max;
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <View className="flex-row items-center gap-2 mb-4 mt-2">
        <View className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">3</Text>
        </View>
        <Text className="text-gray-800 font-bold text-base">Inventory</Text>
      </View>

      {/* Current Stock */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Current Stock <Text className="text-red-400">*</Text></Text>
      <View className="flex-row gap-3 mb-1">
        <TextInput
          value={data.currentStock}
          onChangeText={v => setData({...data, currentStock: v})}
          keyboardType="numeric"
          placeholder="20"
          placeholderTextColor="#9ca3af"
          className={`flex-1 border rounded-xl px-4 py-3 text-gray-800 text-sm ${errors.currentStock || stockExceedsMax ? 'border-red-400' : 'border-gray-200'}`}
        />
        <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
          <Text className="text-gray-600 text-sm">{unit}</Text>
        </View>
      </View>
      {errors.currentStock && <Text className="text-red-400 text-xs mb-2">Current stock is required.</Text>}
      {stockExceedsMax && <Text className="text-red-400 text-xs mb-2">Current stock cannot exceed maximum stock.</Text>}
      {!errors.currentStock && !stockExceedsMax && <View className="mb-4" />}

      {/* Max Stock */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Maximum Stock <Text className="text-red-400">*</Text></Text>
      <Text className="text-gray-400 text-xs mb-2">The full capacity when fully restocked</Text>
      <View className="flex-row gap-3 mb-1">
        <TextInput
          value={data.maxStock}
          onChangeText={v => setData({...data, maxStock: v})}
          keyboardType="numeric"
          placeholder="100"
          placeholderTextColor="#9ca3af"
          className={`flex-1 border rounded-xl px-4 py-3 text-gray-800 text-sm ${errors.maxStock ? 'border-red-400' : 'border-gray-200'}`}
        />
        <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
          <Text className="text-gray-600 text-sm">{unit}</Text>
        </View>
      </View>
      {errors.maxStock && <Text className="text-red-400 text-xs mb-2">Maximum stock is required.</Text>}
      {!errors.maxStock && <View className="mb-4" />}

      {/* Dose Amount */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Dose Amount <Text className="text-red-400">*</Text></Text>
      <View className="flex-row gap-3 mb-1">
        <TextInput
          value={data.doseAmount}
          onChangeText={v => setData({...data, doseAmount: v})}
          keyboardType="numeric"
          placeholder="1"
          placeholderTextColor="#9ca3af"
          className={`flex-1 border rounded-xl px-4 py-3 text-gray-800 text-sm ${errors.doseAmount ? 'border-red-400' : 'border-gray-200'}`}
        />
        <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
          <Text className="text-gray-600 text-sm">{unit} per dose</Text>
        </View>
      </View>
      {errors.doseAmount && <Text className="text-red-400 text-xs mb-2">Dose amount is required.</Text>}
      {!errors.doseAmount && <View className="mb-4" />}

      {/* Low Stock Alert Toggle */}
      <View className="border border-gray-200 rounded-xl px-4 py-3 mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-medium">Low Stock Alert</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Get notified when stock is running low</Text>
          </View>
          <Switch
            value={data.lowStockAlert}
            onValueChange={v => setData({...data, lowStockAlert: v})}
            trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Low Stock Threshold */}
      {data.lowStockAlert && (
        <>
          <Text className="text-gray-700 text-sm font-medium mb-2">Low Stock Threshold</Text>
          <Text className="text-gray-400 text-xs mb-2">You'll be notified when stock drops to or below this</Text>
          <View className="flex-row gap-3 mb-4">
            <TextInput
              value={data.lowStockThreshold}
              onChangeText={v => setData({...data, lowStockThreshold: v})}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor="#9ca3af"
              className={`flex-1 border rounded-xl px-4 py-3 text-gray-800 text-sm ${thresholdExceedsMax ? 'border-red-400' : 'border-gray-200'}`}
            />
            <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
              <Text className="text-gray-600 text-sm">{unit}</Text>
            </View>
          </View>
          {thresholdExceedsMax && (
            <Text className="text-red-400 text-xs mb-2">Threshold cannot exceed maximum stock.</Text>
          )}
        </>
      )}

      {/* Info note */}
      <View className="flex-row items-center gap-3 bg-orange-50 rounded-xl px-4 py-3 mb-4">
        <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center">
          <Stock width={20} height={20} color='#B56B0E'/>
        </View>
        <Text className="text-orange-700 text-xs flex-1">
          You will be notified when your stock reaches or goes below the threshold.
        </Text>
      </View>

      <View className="h-24" />
    </ScrollView>
  );
}

// Step 4
function Step4({data, setData}: {data: any; setData: (d: any) => void}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <View className="flex-row items-center gap-2 mb-2 mt-2">
        <View className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">4</Text>
        </View>
        <Text className="text-gray-800 font-bold text-base">Intake Tracking Method</Text>
      </View>
      <Text className="text-gray-400 text-sm mb-4">How do you want to log your medicine intake?</Text>

      {/* Standard Option */}
      <TouchableOpacity
        onPress={() => setData({...data, trackingMethod: 'standard'})}
        className={`rounded-2xl p-4 mb-3 border-2 ${data.trackingMethod === 'standard' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 bg-teal-100 rounded-xl items-center justify-center">
            <Tap width={20} height={20} color='#038B42'/>
          </View>
          <View className="flex-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-800 font-semibold text-sm">Standard (Tap to Log)</Text>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${data.trackingMethod === 'standard' ? 'border-teal-500' : 'border-gray-300'}`}>
                {data.trackingMethod === 'standard' && <View className="w-3 h-3 rounded-full bg-teal-500" />}
              </View>
            </View>
            <Text className="text-gray-400 text-xs mt-1">Press the 'Taken' button after you have taken your medicine.</Text>
            {data.trackingMethod === 'standard' && (
              <View className="mt-2 gap-1">
                {['Quick and easy', 'Works anytime and anywhere', 'Manual Confirmation'].map(f => (
                  <View key={f} className="flex-row items-center gap-2">
                    <Text className="text-teal-500 text-xs">✓</Text>
                    <Text className="text-gray-600 text-xs">{f}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* QR Code Option */}
      <TouchableOpacity
        onPress={() => setData({...data, trackingMethod: 'qr'})}
        className={`rounded-2xl p-4 mb-3 border-2 ${data.trackingMethod === 'qr' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 bg-purple-100 rounded-xl items-center justify-center">
            <QR width={20} height={20} color='#634DD2'/>
          </View>
          <View className="flex-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-800 font-semibold text-sm">QR Code Scanner</Text>
              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${data.trackingMethod === 'qr' ? 'border-teal-500' : 'border-gray-300'}`}>
                {data.trackingMethod === 'qr' && <View className="w-3 h-3 rounded-full bg-teal-500" />}
              </View>
            </View>
            <Text className="text-gray-400 text-xs mt-1">Scan the medicine's QR code to automatically log your intake.</Text>
            {data.trackingMethod === 'qr' && (
              <>
                <View className="mt-2 gap-1 mb-3">
                  {['Automatic Logging', 'Great for medical adherence', 'Encourages on-time intake and medicine monitoring'].map(f => (
                    <View key={f} className="flex-row items-center gap-2">
                      <Text className="text-teal-500 text-xs">✓</Text>
                      <Text className="text-gray-600 text-xs">{f}</Text>
                    </View>
                  ))}
                </View>
                {/* QR Code placeholder */}
                <View className="flex flex-row items-center justify-around">
                  <View className="w-36 h-36 bg-gray-200 rounded-xl items-center justify-center">
                    <Text className="text-gray-400 text-xs">QR Code</Text>
                  </View>
                  <TouchableOpacity className="flex-column justify-center items-center bg-teal-500 p-2 rounded-xl">
                    <Text className="text-white text-sm font-semibold mb-2">Download QR Code</Text>
                    <Download width={16} height={16} color='white'/>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View className="h-24" />
    </ScrollView>
  );
}
import Download from '../assets/svg_icons/download.svg';
import {addMedicine, buildRRule} from '../database/services';
// Main Screen
export default function AddMedicineScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const isEdit = !!route.params?.id;
  const [step, setStep] = useState(1);
  const [step1Errors, setStep1Errors] = useState<Record<string, boolean>>({});
  const [step3Errors, setStep3Errors] = useState<Record<string, boolean>>({});

  const [step1, setStep1] = useState({
    color: '#1F2937', name: '', genericName: '', manufacturer: '', dosage: '', form: 'Tablet',
  });
  const [step2, setStep2] = useState({
    startDate: new Date() as Date,
    intakeTimes: [new Date()] as Date[],
    repeatType: 'Every Day' as 'Every Day' | 'Custom',
    repeatDays: [] as string[],
    endsType: 'Never' as 'Never' | 'On Date' | 'After Occurrences',
    endDate: null as Date | null,
    occurrences: '',
    reminderEnabled: true,
  });
  const [step3, setStep3] = useState({
    currentStock: '', maxStock: '', doseAmount: '', lowStockAlert: true, lowStockThreshold: '5',
  });
  const [step4, setStep4] = useState({
    trackingMethod: 'standard',
  });

  const handleSave = async () => {
    try {
      const rrule = buildRRule(
        step2.repeatType === 'Every Day' ? 'Every day' : 'Custom',
        step2.repeatDays,
        step2.endsType === 'Never'
          ? 'never'
          : step2.endsType === 'On Date'
          ? 'on_date'
          : 'after_occurrences',
        step2.occurrences ? parseInt(step2.occurrences) : undefined,
        step2.endDate ? step2.endDate.getTime() : undefined,
      );

      const intakeTimeStrings = step2.intakeTimes.map(t =>
        `${String(new Date(t).getHours()).padStart(2, '0')}:${String(new Date(t).getMinutes()).padStart(2, '0')}`,
      );

      await addMedicine({
        name: step1.name.trim(),
        genericName: step1.genericName,
        manufacturer: step1.manufacturer,
        color: step1.color,
        form: step1.form,
        dosage: step1.dosage,
        intakeTimes: intakeTimeStrings,
        startDate: step2.startDate,
        rrule,
        endsType: step2.endsType === 'Never'
          ? 'never'
          : step2.endsType === 'On Date'
          ? 'on_date'
          : 'after_occurrences',
        endDate: step2.endDate ? step2.endDate.getTime() : undefined,
        occurrencesCount: step2.occurrences ? parseInt(step2.occurrences) : undefined,
        reminderEnabled: step2.reminderEnabled,
        currentStock: parseFloat(step3.currentStock) || 0,
        maxStock: parseFloat(step3.maxStock) || 0,
        lowStockAlert: step3.lowStockAlert,
        lowStockThreshold: parseFloat(step3.lowStockThreshold) || 0,
        trackingMethod: step4.trackingMethod,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save medicine. Please try again.');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const errors: Record<string, boolean> = {};
      if (!step1.name.trim()) errors.name = true;
      if (!step1.dosage.trim()) errors.dosage = true;
      setStep1Errors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (step === 2) {
      if (step2.repeatType === 'Custom' && step2.repeatDays.length === 0) {
        Alert.alert('Required', 'Please select at least one day for custom repeat.'); return;
      }
      if (step2.endsType === 'On Date' && !step2.endDate) {
        Alert.alert('Required', 'Please pick an end date.'); return;
      }
      if (step2.endsType === 'After Occurrences' && !step2.occurrences) {
        Alert.alert('Required', 'Please enter the number of occurrences.'); return;
      }
    }
    if (step === 3) {
      const current = parseFloat(step3.currentStock);
      const max = parseFloat(step3.maxStock);
      const dose = parseFloat(step3.doseAmount);
      const errors: Record<string, boolean> = {};
      if (!step3.currentStock || isNaN(current)) errors.currentStock = true;
      if (!step3.maxStock || isNaN(max)) errors.maxStock = true;
      if (!step3.doseAmount || isNaN(dose)) errors.doseAmount = true;
      setStep3Errors(errors);
      if (Object.keys(errors).length > 0) return;
      if (current > max) { Alert.alert('Invalid', 'Current stock cannot exceed maximum stock.'); return; }
      if (step3.lowStockAlert && !step3.lowStockThreshold) {
        Alert.alert('Required', 'Please enter a low stock threshold.'); return;
      }
      const thresholdVal = parseFloat(step3.lowStockThreshold);
      if (step3.lowStockAlert && !isNaN(thresholdVal) && thresholdVal > max) {
        Alert.alert('Invalid', 'Low stock threshold cannot exceed maximum stock.'); return;
      }
    }
    if (step < 4) setStep(step + 1);
  };
  const handleBack = () => { if (step > 1) setStep(step - 1); else navigation.goBack(); };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-2 border-b border-gray-100">
        <TouchableOpacity onPress={handleBack} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          {isEdit ? 'Edit Medicine' : 'Add Medicine'}
        </Text>
      </View>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      {/* Step Content */}
      <View className="flex-1">
        {step === 1 && <Step1 data={step1} setData={d => { setStep1(d); setStep1Errors({}); }} errors={step1Errors} />}
        {step === 2 && <Step2 data={step2} setData={setStep2} />}
        {step === 3 && <Step3 data={step3} setData={d => { setStep3(d); setStep3Errors({}); }} unit={FORM_UNIT_MAP[step1.form] ?? 'Unit(s)'} errors={step3Errors} />}
        {step === 4 && <Step4 data={step4} setData={setStep4} />}
      </View>

      {/* Bottom Buttons */}
      <View className={`flex-row gap-3 px-4 py-4 border-t border-gray-100 ${step === 1 ? '' : ''}`}>
        {step > 1 && (
          <TouchableOpacity
            onPress={handleBack}
            className="flex-1 border border-gray-200 rounded-2xl py-4 items-center">
            <Text className="text-gray-600 font-semibold text-base">Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={step === 4 ? handleSave : handleNext}
          className="flex-1 bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">
            {step === 4 ? (isEdit ? 'Save Changes' : 'Save Medicine') : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
