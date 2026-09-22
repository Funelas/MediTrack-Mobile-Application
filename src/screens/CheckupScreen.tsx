import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import CategoryIconPickerModal, {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import FloatingAddButton from '../components/FloatingAddButton';
import Calendar from '../assets/svg_icons/calendar.svg';
// --- Types ---
type ResultStatus = 'normal' | 'high' | 'low';

interface TestResult {
  date: string;
  dateObj: Date;
  value: string;
  status: ResultStatus;
  referenceRange: string;
}

interface TestItem {
  id: string;
  name: string;
  unit: string;
  results: TestResult[];
}

interface Category {
  id: string;
  label: string;
  icon: CategoryIconKey;
  tests: TestItem[];
}

// --- Placeholder Data ---
const categories: Category[] = [
  {
    id: 'clinical',
    label: 'Clinical Chemistry',
    icon: 'flask',
    tests: [
      {
        id: 'hba1c', name: 'HbA1C', unit: '%',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '5.4', status: 'normal', referenceRange: '4.0 - 5.6'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '6.1', status: 'high', referenceRange: '4.0 - 5.6'},
        ],
      },
      {
        id: 'fbs', name: 'FBS', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '184', status: 'high', referenceRange: '70 - 100'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '168', status: 'high', referenceRange: '70 - 100'},
        ],
      },
      {
        id: 'hdl', name: 'HDL', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '47', status: 'normal', referenceRange: '>40'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '48', status: 'normal', referenceRange: '>40'},
        ],
      },
      {
        id: 'ldl', name: 'LDL', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '112', status: 'high', referenceRange: '<100'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '98', status: 'normal', referenceRange: '<100'},
        ],
      },
      {
        id: 'vldl', name: 'VLDL', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '18', status: 'normal', referenceRange: '2 - 30'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '14', status: 'normal', referenceRange: '2 - 30'},
        ],
      },
      {
        id: 'triglycerides', name: 'Triglycerides', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '75', status: 'normal', referenceRange: '<150'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '74', status: 'normal', referenceRange: '<150'},
        ],
      },
      {
        id: 'bun', name: 'BUN', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '13', status: 'normal', referenceRange: '7 - 20'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '14', status: 'normal', referenceRange: '7 - 20'},
        ],
      },
      {
        id: 'creatinine', name: 'Creatinine', unit: 'mg/dL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '0.94', status: 'normal', referenceRange: '0.6 - 1.2'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '0.88', status: 'normal', referenceRange: '0.6 - 1.2'},
        ],
      },
      {
        id: 'sgpt', name: 'SGPT (ALT)', unit: 'U/L',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '60', status: 'high', referenceRange: '7 - 56'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '48', status: 'normal', referenceRange: '7 - 56'},
        ],
      },
      {
        id: 'sgot', name: 'SGOT (AST)', unit: 'U/L',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '0.56', status: 'normal', referenceRange: '10 - 40'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '0.26', status: 'normal', referenceRange: '10 - 40'},
        ],
      },
    ],
  },
  {
    id: 'cbc',
    label: 'CBC',
    icon: 'cell',
    tests: [
      {
        id: 'wbc', name: 'WBC', unit: 'x10³/µL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '6.8', status: 'normal', referenceRange: '4.5 - 11.0'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '7.2', status: 'normal', referenceRange: '4.5 - 11.0'},
        ],
      },
      {
        id: 'rbc', name: 'RBC', unit: 'x10⁶/µL',
        results: [
          {date: 'Feb 08, 2026', dateObj: new Date(2026, 1, 8), value: '4.9', status: 'normal', referenceRange: '4.5 - 5.5'},
          {date: 'Jul 15, 2026', dateObj: new Date(2026, 6, 15), value: '5.1', status: 'normal', referenceRange: '4.5 - 5.5'},
        ],
      },
    ],
  },
];

const summary = {normal: 11, high: 3, low: 1, improvement: 6};

// --- Helpers ---
const statusColor: Record<ResultStatus, string> = {
  normal: '#14B8A6',
  high: '#F97316',
  low: '#EF4444',
};

const statusBg: Record<ResultStatus, string> = {
  normal: '#F0FDFA',
  high: '#FFF7ED',
  low: '#FEF2F2',
};

const statusLabel: Record<ResultStatus, string> = {
  normal: 'Normal',
  high: 'High',
  low: 'Low',
};

const statusIcon: Record<ResultStatus, string> = {
  normal: '✓',
  high: '▲',
  low: '▼',
};

function StatusBadge({status}: {status: ResultStatus}) {
  return (
    <View
      className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
      style={{backgroundColor: statusBg[status]}}>
      <Text style={{color: statusColor[status], fontSize: 10}}>{statusIcon[status]}</Text>
      <Text style={{color: statusColor[status]}} className="text-xs font-semibold">
        {statusLabel[status]}
      </Text>
    </View>
  );
}

function TestCard({test, filteredDates}: {test: TestItem; filteredDates: Date[]}) {
  const [expanded, setExpanded] = useState(false);

  const filteredResults = test.results.filter(r =>
    filteredDates.some(d => d.toDateString() === r.dateObj.toDateString())
  );

  if (filteredResults.length === 0) return null;

  const latest = filteredResults[filteredResults.length - 1];

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm">

      {/* Collapsed Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-gray-800 text-sm font-semibold">{test.name}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{test.unit}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-gray-700 text-sm font-bold">{latest.value} {test.unit}</Text>
          <StatusBadge status={latest.status} />
        </View>
        <Text className="text-gray-400 text-base ml-2">{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Expanded History */}
      {expanded && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">History</Text>

          {/* Header row */}
          <View className="flex-row items-center pb-1 mb-1 border-b border-gray-100">
            <Text className="text-gray-400 text-xs w-24">Date</Text>
            <Text className="text-gray-400 text-xs flex-1 text-center">Value</Text>
            <Text className="text-gray-400 text-xs w-20 text-center">Ref. Range</Text>
            <Text className="text-gray-400 text-xs w-16 text-right">Status</Text>
          </View>

          {filteredResults.map((result, index) => (
            <View
              key={index}
              className="flex-row items-center py-2"
              style={{borderBottomWidth: index < filteredResults.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6'}}>
              <Text className="text-gray-500 text-xs w-24">{result.date}</Text>
              <Text className="text-gray-800 text-sm font-semibold flex-1 text-center">{result.value}</Text>
              <Text className="text-gray-400 text-xs w-20 text-center">{result.referenceRange}</Text>
              <View className="w-16 items-end">
                <StatusBadge status={result.status} />
              </View>
            </View>
          ))}

          {/* Trend */}
          {filteredResults.length >= 2 && (() => {
            const prev = parseFloat(filteredResults[filteredResults.length - 2].value);
            const curr = parseFloat(filteredResults[filteredResults.length - 1].value);
            const diff = curr - prev;
            const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : '0';
            const improved = diff < 0;
            return (
              <View className="flex-row items-center gap-1 mt-2">
                <Text style={{color: improved ? '#14B8A6' : '#F97316'}} className="text-xs font-semibold">
                  {diff > 0 ? '+' : ''}{pct}%
                </Text>
                <Text className="text-gray-400 text-xs">vs. previous checkup</Text>
              </View>
            );
          })()}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CheckupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ReportsStackParamList>>();
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(2026, 1, 8));
  const [toDate, setToDate] = useState(new Date(2026, 6, 15));
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'});

  // Collect all unique dates within range across all tests
  const allDatesInRange = Array.from(
    new Set(
      selectedCategory.tests.flatMap(t =>
        t.results
          .filter(r => r.dateObj >= fromDate && r.dateObj <= toDate)
          .map(r => r.dateObj.toDateString())
      )
    )
  ).map(d => new Date(d));

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
        <Text className="text-white text-2xl font-bold">Checkup Reports</Text>
        <Text className="text-teal-100 text-sm mt-1">
          View and track your health results over time.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 mt-4">

          {/* Category Dropdown */}
          <View className="mb-3" style={{zIndex: 10}}>
            <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">Category</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryDropdown(v => !v)}
              className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-2">
                <CategoryIcon iconKey={selectedCategory.icon} size={18} color="#14B8A6" />
                <Text className="text-gray-700 text-sm font-medium">{selectedCategory.label}</Text>
              </View>
              <Text className="text-gray-400">{showCategoryDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showCategoryDropdown && (
              <View
                className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                style={{position: 'absolute', top: 72, left: 0, right: 0, zIndex: 20, elevation: 5,
                  shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4}}>
                {categories.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                    className={`flex-row items-center gap-3 px-4 py-3 ${selectedCategory.id === cat.id ? 'bg-teal-50' : 'bg-white'} ${i < categories.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <CategoryIcon iconKey={cat.icon} size={18} color={selectedCategory.id === cat.id ? '#14B8A6' : '#6B7280'} />
                    <Text className={`text-sm ${selectedCategory.id === cat.id ? 'text-teal-600 font-medium' : 'text-gray-700'}`}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date Range */}
          <View className="flex-row gap-3 mb-4 items-center">
            <View className="flex-1">
              <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">From</Text>
              <TouchableOpacity
                onPress={() => setShowFromPicker(true)}
                className="flex-row items-center gap-x-2 bg-white border border-gray-200 rounded-xl px-3 py-3">
                <Calendar width={20} height={20} color='black' />
                <Text className="text-gray-600 text-sm">{formatDate(fromDate)}</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">To</Text>
              <TouchableOpacity
                onPress={() => setShowToPicker(true)}
                className="flex-row items-center gap-x-2 bg-white border border-gray-200 rounded-xl px-3 py-3">
                <Calendar width={20} height={20} color='black' />
                <Text className="text-gray-600 text-sm">{formatDate(toDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showFromPicker && (
            <DateTimePicker
              value={fromDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={toDate}
              onChange={(_, selected) => {
                setShowFromPicker(false);
                if (selected) setFromDate(selected);
              }}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={toDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={fromDate}
              onChange={(_, selected) => {
                setShowToPicker(false);
                if (selected) setToDate(selected);
              }}
            />
          )}

          {/* Overall Summary */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-gray-800 font-bold text-sm mb-3">Overall Summary</Text>
            <View className="flex-row flex-wrap gap-3">
              <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-teal-50 rounded-xl p-3">
                <View className="w-8 h-8 bg-teal-500 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">✓</Text>
                </View>
                <View>
                  <Text className="text-teal-600 text-lg font-bold">{summary.normal}</Text>
                  <Text className="text-gray-400 text-xs">Normal</Text>
                  <Text className="text-gray-400 text-xs">Within range</Text>
                </View>
              </View>
              <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-orange-50 rounded-xl p-3">
                <View className="w-8 h-8 bg-orange-400 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">▲</Text>
                </View>
                <View>
                  <Text className="text-orange-500 text-lg font-bold">{summary.high}</Text>
                  <Text className="text-gray-400 text-xs">High</Text>
                  <Text className="text-gray-400 text-xs">Above range</Text>
                </View>
              </View>
              <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-red-50 rounded-xl p-3">
                <View className="w-8 h-8 bg-red-400 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">▼</Text>
                </View>
                <View>
                  <Text className="text-red-500 text-lg font-bold">{summary.low}</Text>
                  <Text className="text-gray-400 text-xs">Low</Text>
                  <Text className="text-gray-400 text-xs">Below range</Text>
                </View>
              </View>
              <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-blue-50 rounded-xl p-3">
                <View className="w-8 h-8 bg-blue-400 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">↑</Text>
                </View>
                <View>
                  <Text className="text-blue-500 text-lg font-bold">+{summary.improvement}%</Text>
                  <Text className="text-gray-400 text-xs">Improvement</Text>
                  <Text className="text-gray-400 text-xs">vs. previous</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Test Results */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-800 font-bold text-sm">{selectedCategory.label}</Text>
            <View className="flex-row gap-3">
              {(['normal', 'high', 'low'] as ResultStatus[]).map(s => (
                <View key={s} className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full" style={{backgroundColor: statusColor[s]}} />
                  <Text className="text-gray-400 text-xs capitalize">{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {selectedCategory.tests.map(test => (
            <TestCard key={test.id} test={test} filteredDates={allDatesInRange} />
          ))}

          <View className="h-24" />
        </View>
      </ScrollView>

      <CategoryIconPickerModal
        visible={showIconPicker}
        selected={selectedCategory.icon}
        onSelect={() => {}}
        onClose={() => setShowIconPicker(false)}
      />
      <FloatingAddButton onPress={() => navigation.navigate('AddCheckupReport')} />
    </SafeAreaView>
  );
}
