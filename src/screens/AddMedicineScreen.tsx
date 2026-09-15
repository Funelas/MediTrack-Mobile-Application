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
} from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import {useNavigation} from '@react-navigation/native';
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
function Step1({data, setData}: {data: any; setData: (d: any) => void}) {
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
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
      />

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
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
      />

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
function Step2({data, setData}: {data: any; setData: (d: any) => void}) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  const formattedTime = data.intakeTime.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});

  const handleRepeatSave = (value: string) => {
    if (value === 'Custom') setShowCustomRepeat(true);
    else setData({...data, repeat: value});
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <View className="flex-row items-center gap-2 mb-4 mt-2">
        <View className="w-7 h-7 rounded-full bg-teal-500 items-center justify-center">
          <Text className="text-white text-xs font-bold">2</Text>
        </View>
        <Text className="text-gray-800 font-bold text-base">Schedule & Reminder</Text>
      </View>

      {/* Time of Intake */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Time of Intake</Text>
      <TouchableOpacity
        onPress={() => setShowTimePicker(true)}
        className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
        <View className="flex-row items-center gap-x-2">
          <Clock width={20} height={20} color='black'/>
          <Text className="text-gray-600 text-sm">{formattedTime}</Text>
        </View>
        <Text className="text-gray-400 text-lg">›</Text>
      </TouchableOpacity>

      {/* How many times per day */}
      <Text className="text-gray-700 text-sm font-medium mb-2">How many times per day? <Text className="text-red-400">*</Text></Text>
      <View className="flex-row items-center border border-gray-200 rounded-xl overflow-hidden mb-4">
        <TouchableOpacity
          onPress={() => setData({...data, timesPerDay: Math.max(1, data.timesPerDay - 1)})}
          className="px-5 py-3 bg-gray-50">
          <Text className="text-gray-600 text-lg font-bold">−</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-gray-800 text-sm font-semibold">{data.timesPerDay} {data.timesPerDay === 1 ? 'time' : 'times'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setData({...data, timesPerDay: data.timesPerDay + 1})}
          className="px-5 py-3 bg-gray-50">
          <Text className="text-gray-600 text-lg font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {/* Repeat */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Repeat</Text>
      <TouchableOpacity
        onPress={() => setShowRepeatModal(true)}
        className="flex-row items-center justify-between border border-gray-200 rounded-xl px-4 py-3 mb-4">
        <Text className="text-gray-600 text-sm">{data.repeat}</Text>
        <Text className="text-gray-400 text-lg">›</Text>
      </TouchableOpacity>

      {/* Reminder Toggle */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Reminder</Text>
      <View className="border border-gray-200 rounded-xl px-4 py-3 mb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-medium">Medication Reminder</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Get a reminder when its time</Text>
          </View>
          <Switch
            value={data.reminderEnabled}
            onValueChange={v => setData({...data, reminderEnabled: v})}
            trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Info note */}
      <View className="flex-row items-center gap-3 bg-teal-50 rounded-xl px-4 py-3 mb-4">
        <View className="w-8 h-8 bg-teal-100 rounded-full items-center justify-center">
          <Bell width={20} height={20} color='#068B48'/>
        </View>
        <Text className="text-teal-700 text-xs flex-1">You can manage or snooze reminders anytime.</Text>
      </View>

      {showTimePicker && (
        <DateTimePicker
          value={data.intakeTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShowTimePicker(false);
            if (selected) setData({...data, intakeTime: selected});
          }}
        />
      )}

      <RadioSelectModal
        visible={showRepeatModal}
        title="Repeat"
        options={REPEAT_OPTIONS}
        selected={data.repeat}
        onSave={handleRepeatSave}
        onClose={() => setShowRepeatModal(false)}
      />
      <CustomRepeatModal
        visible={showCustomRepeat}
        onSave={v => setData({...data, repeat: v})}
        onClose={() => setShowCustomRepeat(false)}
      />
      <View className="h-24" />
    </ScrollView>
  );
}

// Step 3
function Step3({data, setData, unit}: {data: any; setData: (d: any) => void; unit: string}) {
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
      <View className="flex-row gap-3 mb-4">
        <TextInput
          value={data.currentStock}
          onChangeText={v => setData({...data, currentStock: v})}
          keyboardType="numeric"
          placeholder="20"
          placeholderTextColor="#9ca3af"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
        />
        <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
          <Text className="text-gray-600 text-sm">{unit}</Text>
        </View>
      </View>

      {/* Dose Amount */}
      <Text className="text-gray-700 text-sm font-medium mb-2">Dose Amount <Text className="text-red-400">*</Text></Text>
      <View className="flex-row gap-3 mb-4">
        <TextInput
          value={data.doseAmount}
          onChangeText={v => setData({...data, doseAmount: v})}
          keyboardType="numeric"
          placeholder="1"
          placeholderTextColor="#9ca3af"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
        />
        <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
          <Text className="text-gray-600 text-sm">{unit} per dose</Text>
        </View>
      </View>

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
          <View className="flex-row gap-3 mb-4">
            <TextInput
              value={data.lowStockThreshold}
              onChangeText={v => setData({...data, lowStockThreshold: v})}
              keyboardType="numeric"
              placeholder="5"
              placeholderTextColor="#9ca3af"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
            />
            <View className="border border-gray-200 rounded-xl px-4 py-3 justify-center">
              <Text className="text-gray-600 text-sm">{unit}</Text>
            </View>
          </View>
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
// Main Screen
export default function AddMedicineScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);

  const [step1, setStep1] = useState({
    color: '#1F2937', name: '', genericName: '', manufacturer: '', dosage: '', form: 'Tablet',
  });
  const [step2, setStep2] = useState({
    intakeTime: new Date(), timesPerDay: 1, repeat: 'Does not repeat', reminderEnabled: true,
  });
  const [step3, setStep3] = useState({
    currentStock: '', doseAmount: '', lowStockAlert: true, lowStockThreshold: '5',
  });
  const [step4, setStep4] = useState({
    trackingMethod: 'standard',
  });

  const handleNext = () => { if (step < 4) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); else navigation.goBack(); };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-2 border-b border-gray-100">
        <TouchableOpacity onPress={handleBack} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          Add Medicine
        </Text>
      </View>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      {/* Step Content */}
      <View className="flex-1">
        {step === 1 && <Step1 data={step1} setData={setStep1} />}
        {step === 2 && <Step2 data={step2} setData={setStep2} />}
        {step === 3 && <Step3 data={step3} setData={setStep3} unit={FORM_UNIT_MAP[step1.form] ?? 'Unit(s)'} />}
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
          onPress={step === 4 ? () => navigation.goBack() : handleNext}
          className="flex-1 bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">
            {step === 4 ? 'Save Medicine' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
