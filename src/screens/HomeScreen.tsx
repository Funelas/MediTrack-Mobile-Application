import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import Bell from '../assets/svg_icons/bell.svg';
import Arrow from '../assets/svg_icons/arrow.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Heart from '../assets/svg_icons/heart.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Check from '../assets/svg_icons/check.svg';
import CircularProgress from '../components/CircularProgress';
import {useFocusEffect} from '@react-navigation/native';
import {getItemsForDay, upsertOccurrence, VirtualItem} from '../database/services';

const healthSummary = {
  status: 'Good',
  statusDetail: '8 of 10 results within normal range.',
  lastCheckup: 'June 6, 2026',
  improved: ['HbA1C', 'LDL Cholesterol'],
  needsAttention: ['SGPT (ALT)', 'SGOT (AST)'],
};

// ─── helpers ────────────────────────────────────────────────────────────────

/** Convert "HH:MM" string to minutes-from-now */
function getMinutesFromNow(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatCountdown(mins: number): string {
  if (mins <= 0) return 'Now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** "HH:MM" → "9:00 AM" */
function formatTimeStr(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
}

function typeLabel(type: string): string {
  if (type === 'appointment') return 'Appointment';
  if (type === 'med') return 'Medication';
  return 'Reminder';
}

// ─── NextUpCard ──────────────────────────────────────────────────────────────

function NextUpCard({
  item,
  now,
  onMarkDone,
}: {
  item: VirtualItem | null;
  now: Date;
  onMarkDone: (item: VirtualItem) => void;
}) {
  const {width} = useWindowDimensions();
  const scale = width / 390;
  const s = (n: number) => Math.round(n * scale);

  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!item) return;
    const [h, m] = item.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const start = target.getTime() - 30 * 60 * 1000;
    const elapsed = Date.now() - start;
    const progress = Math.min(Math.max(elapsed / (30 * 60 * 1000), 0), 1);
    Animated.timing(barAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [item, now]);

  // ── all-done / no items ──
  if (!item) {
    return (
      <View className="bg-white rounded-2xl p-4 shadow-sm items-center gap-2">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mt-1"
          style={{backgroundColor: '#CCFBF1'}}>
          <Check width={s(24)} height={s(24)} color="#14B8A6" />
        </View>
        <Text className="text-gray-800 font-bold text-sm mt-1">All done for today!</Text>
        <Text className="text-gray-400 text-xs text-center pb-1">
          No more scheduled items. Great job keeping up.
        </Text>
      </View>
    );
  }

  const mins = getMinutesFromNow(item.time);
  const isOverdue = mins < 0;
  const accentColor = isOverdue ? '#EF4444' : '#14B8A6';
  const accentBg = isOverdue ? '#FEF2F2' : '#F0FDFA';
  const accentBar = isOverdue ? '#FECACA' : '#CCFBF1';

  const iconSize = s(22);
  const typeIcon =
    item.type === 'appointment' ? (
      <Calendar width={iconSize} height={iconSize} color="#ffffff" />
    ) : item.type === 'med' ? (
      <Pills width={iconSize} height={iconSize} color="#ffffff" />
    ) : (
      <Bell width={iconSize} height={iconSize} color="#ffffff" />
    );

  const detail =
    item.type === 'appointment' && item.doctorClinic
      ? item.doctorClinic
      : item.notes
      ? item.notes.length > 45
        ? item.notes.slice(0, 45) + '…'
        : item.notes
      : null;

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="bg-white rounded-2xl shadow-sm">
      {/* colored top strip */}
      <View style={{height: 3, backgroundColor: accentColor, borderTopLeftRadius: 16, borderTopRightRadius: 16}} />

      <View className="px-4 pt-3 pb-4">
        {/* header row */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-gray-400 text-xs font-semibold tracking-widest uppercase">
            Next Up
          </Text>
          <View className="flex-row items-center gap-1">
            <Clock width={s(12)} height={s(12)} color={accentColor} />
            <Text className="text-xs font-semibold" style={{color: accentColor}}>
              {isOverdue
                ? `${Math.abs(mins)} min${Math.abs(mins) === 1 ? '' : 's'} ago`
                : formatCountdown(mins)}
            </Text>
            {isOverdue && (
              <View
                className="rounded-full px-2 py-0.5 ml-1"
                style={{backgroundColor: accentBg}}>
                <Text className="text-xs font-bold" style={{color: accentColor}}>
                  Overdue
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* main content row */}
        <View className="flex-row items-center gap-3 mb-3">
          {/* icon bubble */}
          <View
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{backgroundColor: accentColor}}>
            {typeIcon}
          </View>

          {/* text block */}
          <View className="flex-1">
            <Text className="text-gray-800 font-bold text-sm" numberOfLines={1}>
              {item.title}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
              <Text className="text-xs font-medium" style={{color: accentColor}}>
                {typeLabel(item.type)}
              </Text>
              <Text className="text-gray-300 text-xs">·</Text>
              <Text className="text-gray-400 text-xs">{formatTimeStr(item.time)}</Text>
            </View>
            {detail && (
              <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                {detail}
              </Text>
            )}
          </View>
        </View>

        {/* progress bar */}
        <View
          className="h-1 rounded-full mb-3 overflow-hidden"
          style={{backgroundColor: accentBar}}>
          <Animated.View
            style={{
              width: barWidth,
              height: '100%',
              backgroundColor: accentColor,
              borderRadius: 999,
            }}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          className="rounded-xl py-2.5 items-center"
          style={{backgroundColor: accentColor}}
          activeOpacity={0.8}
          onPress={() => item.type !== 'appointment' && onMarkDone(item)}>
          <Text className="text-white text-sm font-bold">
            {item.type === 'appointment' ? 'View Details' : 'Mark as Done'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── schedule row icon ────────────────────────────────────────────────────────

function getItemIcon(item: VirtualItem, size: number) {
  if (item.type === 'appointment')
    return <Calendar width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
  if (item.type === 'med')
    return <Pills width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
  return <Bell width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const {width} = useWindowDimensions();
  const scale = width / 390;
  const s = (size: number) => Math.round(size * scale);
  const iconSm = s(12);
  const iconMd = s(20);
  const iconLg = s(35);

  const [todayItems, setTodayItems] = useState<VirtualItem[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadToday = useCallback(() => {
    getItemsForDay(new Date()).then(setTodayItems);
  }, []);

  useFocusEffect(loadToday);

  const doneCount = todayItems.filter(i => i.isDone).length;

  // next pending item — closest to now (future first, then overdue)
  const nextItem =
    todayItems
      .filter(i => !i.isDone)
      .sort((a, b) => {
        const ma = getMinutesFromNow(a.time);
        const mb = getMinutesFromNow(b.time);
        // future items sorted ascending; overdue sorted by how recently they passed
        if (ma >= 0 && mb >= 0) return ma - mb;
        if (ma < 0 && mb < 0) return mb - ma; // more recent overdue first
        return ma >= 0 ? -1 : 1; // future before overdue
      })[0] ?? null;

  const handleMarkDone = async (item: VirtualItem) => {
    await upsertOccurrence(
      item.referenceId,
      item.referenceType,
      item.date,
      item.time,
      {isDone: true},
    );
    loadToday();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Heart width={iconLg} height={iconLg} color="#FFFFFF" />
              <Text className="text-white text-2xl font-bold">
                Medi<Text className="text-teal-200">Track</Text>
              </Text>
            </View>
            <View className="mr-2 rounded-full bg-[#BDCCDA] flex justify-center items-center p-1">
              <Bell width={s(28)} height={s(28)} color="#26292C" />
            </View>
          </View>
          <Text className="text-white text-2xl font-bold">Welcome back, User!</Text>
          <Text className="text-teal-100 text-sm mt-1">
            Today: {new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}
          </Text>
        </View>

        <View className="px-4 mt-4 gap-y-4 flex-column justify-center">

          {/* Next Up Card */}
          <NextUpCard item={nextItem} now={now} onMarkDone={handleMarkDone} />

          {/* Today's Schedule */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-800 font-semibold text-base">
                Today's Schedule{' '}
                <Text className="text-gray-400 font-normal text-sm">
                  ({doneCount}/{todayItems.length} done)
                </Text>
              </Text>
              <TouchableOpacity>
                <Text className="text-teal-500 text-sm font-medium">View All</Text>
              </TouchableOpacity>
            </View>

            {todayItems.length === 0 && (
              <Text className="text-gray-400 text-sm text-center py-4">No schedules for today.</Text>
            )}

            {todayItems.map((item, index) => (
              <View
                key={item.key}
                className={`border rounded-xl border-1 my-1 p-1 ${
                  item.isDone ? 'border-[#C2DDD8] bg-[#DBE7E5]' : 'border-gray-200 bg-white'
                }`}>
                <View className="flex-row items-center py-3 gap-3">
                  <TouchableOpacity
                    onPress={() => handleMarkDone(item)}
                    className={`w-7 h-7 border border-1 rounded-full flex justify-center items-center ${
                      item.isDone ? 'border-[#139880] bg-[#C2DDD8]' : 'border-[#787878] bg-transparent'
                    }`}>
                    {item.isDone ? <Check width={iconSm} height={iconSm} color="#139880" /> : null}
                  </TouchableOpacity>
                  {getItemIcon(item, iconMd)}
                  <Text className="text-gray-400 text-sm w-16">
                    {formatTimeStr(item.time)}
                  </Text>
                  <Text className="flex-1 text-gray-800 text-sm font-medium">{item.title}</Text>
                  <View style={{transform: [{rotate: '270deg'}]}}>
                    <Arrow width={20} height={20} />
                  </View>
                </View>
                {index < todayItems.length - 1 && <View className="h-px bg-gray-100" />}
              </View>
            ))}
          </View>

          {/* Health Summary Card */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-teal-50 rounded-xl p-3 items-center justify-center">
                <CircularProgress progress={80} size={s(75)} strokeWidth={s(7)}>
                  <Heart width={s(32)} height={s(32)} color="#14B8A6" />
                </CircularProgress>
                <Text className="text-teal-600 font-bold text-lg">{healthSummary.status}</Text>
                <Text className="text-gray-500 text-xs text-center mt-1">
                  {healthSummary.statusDetail}
                </Text>
                <View className="flex-row items-center mt-2 gap-1">
                  <View className="w-3 h-3 bg-gray-300 rounded" />
                  <Text className="text-gray-400 text-xs">
                    Latest checkup {healthSummary.lastCheckup}
                  </Text>
                </View>
              </View>
              <View className="flex-1 gap-3">
                <View className="bg-teal-50 rounded-xl p-3">
                  <Text className="text-teal-600 font-semibold text-xs mb-1">Improved:</Text>
                  {healthSummary.improved.map(item => (
                    <Text key={item} className="text-gray-600 text-xs">• {item}</Text>
                  ))}
                </View>
                <View className="bg-red-50 rounded-xl p-3">
                  <Text className="text-red-500 font-semibold text-xs mb-1">Needs Attention:</Text>
                  {healthSummary.needsAttention.map(item => (
                    <Text key={item} className="text-gray-600 text-xs">• {item}</Text>
                  ))}
                </View>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
