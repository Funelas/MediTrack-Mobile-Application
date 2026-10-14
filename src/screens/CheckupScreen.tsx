import React, {useState, useCallback, useEffect} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import DateTimePicker from '@react-native-community/datetimepicker';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import FloatingAddButton from '../components/FloatingAddButton';
import Calendar from '../assets/svg_icons/calendar.svg';
import {
  getCheckupReports, getCheckupReportsByCategory,
  getCategories, deleteCheckupReport,
} from '../database/services';
import CheckupReport from '../database/models/CheckupReport';
import TestResult from '../database/models/TestResult';
import {database} from '../database';
import {Q} from '@nozbe/watermelondb';
import {BUILT_IN_CATEGORIES, getBuiltInCategory, computeStatus} from '../data/categoryDefinitions';
import Category from '../database/models/Category';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type ResultStatus = 'normal' | 'high' | 'low' | 'unknown';

// ─── helpers ─────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  normal: '#14B8A6', high: '#F97316', low: '#EF4444', unknown: '#9ca3af',
};
const statusBg: Record<string, string> = {
  normal: '#F0FDFA', high: '#FFF7ED', low: '#FEF2F2', unknown: '#F9FAFB',
};
const statusLabel: Record<string, string> = {
  normal: 'Normal', high: 'High', low: 'Low', unknown: '—',
};
const statusIcon: Record<string, string> = {
  normal: '✓', high: '▲', low: '▼', unknown: '·',
};

function StatusBadge({status}: {status: string}) {
  const s = status || 'unknown';
  return (
    <View
      className="flex-row items-center gap-x-1 px-2 py-0.5 rounded-full"
      style={{backgroundColor: statusBg[s] ?? statusBg.unknown}}>
      <Text style={{color: statusColor[s] ?? statusColor.unknown, fontSize: 10}}>
        {statusIcon[s] ?? statusIcon.unknown}
      </Text>
      <Text style={{color: statusColor[s] ?? statusColor.unknown}} className="text-xs font-semibold">
        {statusLabel[s] ?? '—'}
      </Text>
    </View>
  );
}

// ─── merged category type (built-in + user-created) ──────────────────────────

interface DisplayCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

// ─── TestCard ─────────────────────────────────────────────────────────────────

interface TestRow {
  testName: string;
  unit: string;
  normalRange: string;
  value: string;
  status: string;
  date: string;
  dateObj: Date;
}

function TestCard({testName, rows}: {testName: string; rows: TestRow[]}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const latest = rows[rows.length - 1];

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-gray-800 text-sm font-semibold">{testName}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{latest.unit}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-gray-700 text-sm font-bold">
            {latest.value} {latest.unit}
          </Text>
          <StatusBadge status={latest.status} />
        </View>
        <Text className="text-gray-400 text-base ml-2">{expanded ? '▲' : '▼'}</Text>
      </View>

      {expanded && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">History</Text>
          <View className="flex-row items-center pb-1 mb-1 border-b border-gray-100">
            <Text className="text-gray-400 text-xs w-24">Date</Text>
            <Text className="text-gray-400 text-xs flex-1 text-center">Value</Text>
            <Text className="text-gray-400 text-xs w-20 text-center">Ref. Range</Text>
            <Text className="text-gray-400 text-xs w-16 text-right">Status</Text>
          </View>
          {rows.map((r, i) => (
            <View
              key={i}
              className="flex-row items-center py-2"
              style={{
                borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                borderBottomColor: '#F3F4F6',
              }}>
              <Text className="text-gray-500 text-xs w-24">{r.date}</Text>
              <Text className="text-gray-800 text-sm font-semibold flex-1 text-center">
                {r.value}
              </Text>
              <Text className="text-gray-400 text-xs w-20 text-center">
                {r.normalRange || '—'}
              </Text>
              <View className="w-16 items-end">
                <StatusBadge status={r.status} />
              </View>
            </View>
          ))}

          {rows.length >= 2 && (() => {
            const prev = parseFloat(rows[rows.length - 2].value);
            const curr = parseFloat(rows[rows.length - 1].value);
            if (isNaN(prev) || isNaN(curr)) return null;
            const diff = curr - prev;
            const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : '0';
            const improved = diff < 0;
            return (
              <View className="flex-row items-center gap-1 mt-2">
                <Text
                  style={{color: improved ? '#14B8A6' : '#F97316'}}
                  className="text-xs font-semibold">
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

// ─── CheckupScreen ────────────────────────────────────────────────────────────

export default function CheckupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();

  const [allCategories, setAllCategories] = useState<DisplayCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999); // end of today so records saved today are always included
    return d;
  });
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [testRows, setTestRows] = useState<Record<string, TestRow[]>>({});
  const [loading, setLoading] = useState(true);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'});

  // ── load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Merge built-in + user-created categories
        const userCats = await getCategories();
        const builtIn: DisplayCategory[] = BUILT_IN_CATEGORIES.map(c => ({
          id: c.id, label: c.label, icon: c.icon, color: '#14B8A6',
        }));
        const userDisplay: DisplayCategory[] = userCats.map(c => ({
          id: c.id, label: c.label, icon: c.icon, color: c.color,
        }));
        const merged = [...builtIn, ...userDisplay];
        setAllCategories(merged);

        // Use the latest selectedCategoryId from state, fall back to first category
        setSelectedCategoryId(prev => {
          const activeCatId = prev || merged[0]?.id || '';
          if (!activeCatId) return prev;

          // Fire the async load inside the setter so we have the resolved id
          (async () => {
            try {
              // Fetch reports for this category
              const reports = await getCheckupReportsByCategory(activeCatId);
              if (reports.length === 0) { setTestRows({}); setLoading(false); return; }

              // Fetch test results for each report using a targeted query
              const allResults: {
                testName: string; unit: string; normalRange: string;
                value: string; status: string; reportDate: Date;
              }[] = [];

              for (const report of reports) {
                const results = await database
                  .get<TestResult>('test_results')
                  .query(Q.where('report_id', report.id))
                  .fetch();
                const reportDate = new Date(report.checkupDate);
                results.forEach(r => {
                  allResults.push({
                    testName: r.testName,
                    unit: r.unit,
                    normalRange: r.normalRange,
                    value: r.value,
                    status: r.status,
                    reportDate,
                  });
                });
              }

              // Group by test name, filtered by date range
              const grouped: Record<string, TestRow[]> = {};
              for (const r of allResults) {
                if (r.reportDate < fromDate || r.reportDate > toDate) continue;
                const row: TestRow = {
                  testName: r.testName,
                  unit: r.unit,
                  normalRange: r.normalRange,
                  value: r.value,
                  status: r.status,
                  date: r.reportDate.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'}),
                  dateObj: r.reportDate,
                };
                if (!grouped[r.testName]) grouped[r.testName] = [];
                grouped[r.testName].push(row);
              }

              // Sort each group by date ascending
              Object.values(grouped).forEach(rows =>
                rows.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()),
              );
              setTestRows(grouped);
            } finally {
              setLoading(false);
            }
          })();

          return activeCatId;
        });
      } catch {
        setLoading(false);
      }
    };
    run();
  }, [fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      // If returning from a save, auto-select the category that was just saved
      const savedCategoryId = route.params?.savedCategoryId as string | undefined;
      if (savedCategoryId) {
        setSelectedCategoryId(savedCategoryId);
      }
      loadData();
    }, [loadData, route.params?.savedCategoryId]),
  );

  // Reload results when the user switches categories
  useEffect(() => {
    if (!selectedCategoryId) return;
    loadData();
  }, [selectedCategoryId]);

  // ── summary ────────────────────────────────────────────────────────────────
  const allLatest = Object.values(testRows).map(rows => rows[rows.length - 1]);
  const summary = {
    normal: allLatest.filter(r => r.status === 'normal').length,
    high:   allLatest.filter(r => r.status === 'high').length,
    low:    allLatest.filter(r => r.status === 'low').length,
  };

  const selectedCategory = allCategories.find(c => c.id === selectedCategoryId);

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
          <Text className="text-white text-2xl font-bold">Checkup Reports</Text>
          <Text className="text-teal-100 text-sm mt-1">
            View and track your health results over time.
          </Text>
        </View>

        <View className="px-4 mt-4">

          {/* Category Dropdown */}
          <View className="mb-3" style={{zIndex: 10}}>
            <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">Category</Text>
            <TouchableOpacity
              onPress={() => setShowCategoryDropdown(v => !v)}
              className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <View className="flex-row items-center gap-x-2">
                {selectedCategory && (
                  <CategoryIcon
                    iconKey={selectedCategory.icon as CategoryIconKey}
                    size={18}
                    color={selectedCategory.color}
                  />
                )}
                <Text className="text-gray-700 text-sm font-medium">
                  {selectedCategory?.label ?? 'Select category'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {selectedCategory && !BUILT_IN_CATEGORIES.find(c => c.id === selectedCategory.id) && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('CreateCategory', {categoryId: selectedCategory.id})}>
                    <Text className="text-teal-500 text-xs font-medium">Edit</Text>
                  </TouchableOpacity>
                )}
                <Text className="text-gray-400">{showCategoryDropdown ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {showCategoryDropdown && (
              <View
                className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                style={{
                  position: 'absolute', top: 72, left: 0, right: 0, zIndex: 20,
                  elevation: 5, shadowColor: '#000',
                  shadowOffset: {width: 0, height: 2},
                  shadowOpacity: 0.1, shadowRadius: 4,
                }}>
                {allCategories.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setShowCategoryDropdown(false);
                    }}
                    className={`flex-row items-center gap-x-3 px-4 py-3 ${
                      cat.id === selectedCategoryId ? 'bg-teal-50' : 'bg-white'
                    } ${i < allCategories.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <CategoryIcon
                      iconKey={cat.icon as CategoryIconKey}
                      size={18}
                      color={cat.id === selectedCategoryId ? cat.color : '#6B7280'}
                    />
                    <Text className={`text-sm ${
                      cat.id === selectedCategoryId ? 'text-teal-600 font-medium' : 'text-gray-700'
                    }`}>
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
                <Calendar width={20} height={20} color="black" />
                <Text className="text-gray-600 text-sm">{formatDate(fromDate)}</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs font-semibold uppercase mb-2">To</Text>
              <TouchableOpacity
                onPress={() => setShowToPicker(true)}
                className="flex-row items-center gap-x-2 bg-white border border-gray-200 rounded-xl px-3 py-3">
                <Calendar width={20} height={20} color="black" />
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
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowToPicker(false);
                if (selected) {
                  const end = new Date(selected);
                  end.setHours(23, 59, 59, 999); // cover the full selected day
                  setToDate(end);
                }
              }}
            />
          )}

          {loading ? (
            <ActivityIndicator color="#14B8A6" style={{marginTop: 40}} />
          ) : (
            <>
              {/* Overall Summary */}
              {allLatest.length > 0 && (
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
                      </View>
                    </View>
                    <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-orange-50 rounded-xl p-3">
                      <View className="w-8 h-8 bg-orange-400 rounded-full items-center justify-center">
                        <Text className="text-white text-xs font-bold">▲</Text>
                      </View>
                      <View>
                        <Text className="text-orange-500 text-lg font-bold">{summary.high}</Text>
                        <Text className="text-gray-400 text-xs">High</Text>
                      </View>
                    </View>
                    <View className="flex-1 min-w-[40%] flex-row items-center gap-2 bg-red-50 rounded-xl p-3">
                      <View className="w-8 h-8 bg-red-400 rounded-full items-center justify-center">
                        <Text className="text-white text-xs font-bold">▼</Text>
                      </View>
                      <View>
                        <Text className="text-red-500 text-lg font-bold">{summary.low}</Text>
                        <Text className="text-gray-400 text-xs">Low</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Test results */}
              {Object.keys(testRows).length === 0 ? (
                <View className="items-center py-12">
                  <Text className="text-gray-400 text-sm text-center">
                    No results for this category{'\n'}in the selected date range.
                  </Text>
                </View>
              ) : (
                <>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-gray-800 font-bold text-sm">
                      {selectedCategory?.label}
                    </Text>
                    <View className="flex-row gap-3">
                      {(['normal', 'high', 'low'] as const).map(s => (
                        <View key={s} className="flex-row items-center gap-1">
                          <View className="w-2 h-2 rounded-full" style={{backgroundColor: statusColor[s]}} />
                          <Text className="text-gray-400 text-xs capitalize">{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {Object.entries(testRows).map(([testName, rows]) => (
                    <TestCard key={testName} testName={testName} rows={rows} />
                  ))}
                </>
              )}
            </>
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      <FloatingAddButton onPress={() => navigation.navigate('AddCheckupReport')} />
    </SafeAreaView>
  );
}
