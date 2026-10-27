// MOB-03 step 13: reviews a scanned report and saves it (plan 6.1, 6.4 to 6.7). The slot (src/scan/session.ts) holds the
// sanitized payload. Flow: date step (required) -> read the payload with the sex from loadSex -> review rows with their
// reasons and the missing-range prompt -> Save (history, scoring, saving) -> result view. All wording that describes a
// result comes from src/scan/display.ts. The sex is read only through loadSex; nothing is logged or sent.
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  InteractionManager,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import {database} from '../database';
import {loadSex} from '../database/settings';
import {loadHistoryRows, saveEngineReport} from '../database/engineResults';
import {reviewReasons} from '../engine';
import {
  asPrinted,
  basisLine,
  flagLabel,
  notRatedLabel,
  reasonText,
  safeStatus,
  sourceNote,
} from '../scan/display';
import {buildHistory} from '../scan/history';
import {applyRangeAnswer, ReadResult, readPayload, scoreRows} from '../scan/runEngine';
import {checkRangeInput, parseBound, RANGE_MESSAGES} from '../scan/rangeInput';
import {SavedRow, toSavedReport} from '../scan/saveRows';
import {clearSession, getSession} from '../scan/session';
import {isVisitDate, prefillDate} from '../scan/visitDate';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Route = RouteProp<ReportsStackParamList, 'EngineReview'>;
type ReadData = Extract<ReadResult, {kind: 'read'}>;
type Row = ReadData['record']['results'][number];
type Stage = 'date' | 'review' | 'saved';
type RangeText = {low: string; high: string};

const DATE_MESSAGE = 'Type the date of the report as YYYY-MM-DD. It cannot be in the future.';
const RANGE_HINT = 'Type the range exactly as printed.';

const STATUS_TEXT = {normal: 'Normal', high: 'High', low: 'Low', unknown: ''} as const;

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function alertCouldNotRead(): void {
  Alert.alert('Could not read the report', 'Please try again or use Manual Entry.');
}

function alertDateRequired(): void {
  Alert.alert('A date is needed', DATE_MESSAGE);
}

function alertCouldNotSave(): void {
  Alert.alert('Could not save the report', 'The report was not saved. Please try again or use Manual Entry.');
}

function Notice({text}: {text: string}) {
  return (
    <View className="bg-amber-50 rounded-xl px-4 py-3 mb-3">
      <Text className="text-amber-700 text-xs">{text}</Text>
    </View>
  );
}

type ReviewCardProps = {
  row: Row;
  reasons: string[];
  range: RangeText;
  error: string;
  disabled: boolean;
  onChange: (field: 'low' | 'high', text: string) => void;
  onUseRange: () => void;
  onNoRange: () => void;
  onSkip: () => void;
};

function ReviewCard({row, reasons, range, error, disabled, onChange, onUseRange, onNoRange, onSkip}: ReviewCardProps) {
  const printed = asPrinted(row);
  const flag = flagLabel(typeof row.flag === 'string' ? row.flag : null);
  const note = sourceNote(
    typeof row.value_source === 'string' ? row.value_source : null,
    typeof row.ref_source === 'string' ? row.ref_source : null,
  );
  const askRange = reasons.includes('missing_range');
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
      <Text className="text-gray-800 text-sm font-semibold">{textOf(row.test_name)}</Text>
      <Text className="text-gray-600 text-sm mt-1">
        {printed.unit === null ? printed.value : `${printed.value} ${printed.unit}`}
      </Text>
      {flag !== '' && <Text className="text-gray-400 text-xs mt-1">{flag}</Text>}
      {reasons.map(code => (
        <Text key={code} className="text-amber-700 text-xs mt-2">
          {reasonText(code)}
        </Text>
      ))}
      {note !== '' && <Text className="text-gray-400 text-xs mt-2">{note}</Text>}
      {askRange && (
        <View className="mt-3">
          {printed.hint && <Text className="text-gray-500 text-xs mb-2">{RANGE_HINT}</Text>}
          {(['low', 'high'] as const).map(field => (
            <View key={field} className="mb-2">
              <Text className="text-gray-500 text-xs mb-1">{field === 'low' ? 'Lowest' : 'Highest'}</Text>
              <View className="flex-row items-center border border-gray-200 rounded-xl px-3">
                <TextInput
                  value={range[field]}
                  onChangeText={text => onChange(field, text)}
                  keyboardType="decimal-pad"
                  autoCorrect={false}
                  editable={!disabled}
                  className="flex-1 text-gray-800 text-sm py-2"
                />
                {printed.unit !== null && <Text className="text-gray-400 text-xs">{printed.unit}, as printed</Text>}
              </View>
            </View>
          ))}
          {error !== '' && <Text className="text-red-500 text-xs mb-2">{error}</Text>}
          <TouchableOpacity
            onPress={onUseRange}
            disabled={disabled}
            className="bg-teal-500 rounded-xl py-2.5 items-center mb-2">
            <Text className="text-white text-sm font-semibold">Use this range</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNoRange}
            disabled={disabled}
            className="border border-teal-500 rounded-xl py-2.5 items-center mb-2">
            <Text className="text-teal-500 text-sm font-semibold">No range is printed on my report</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} disabled={disabled} className="py-2 items-center">
            <Text className="text-gray-500 text-sm">Skip for now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ReadyLine({row}: {row: Row}) {
  const printed = asPrinted(row);
  const note = sourceNote(
    typeof row.value_source === 'string' ? row.value_source : null,
    typeof row.ref_source === 'string' ? row.ref_source : null,
  );
  return (
    <View className="py-2 border-b border-gray-100">
      <View className="flex-row justify-between">
        <Text className="flex-1 text-gray-700 text-xs">{textOf(row.test_name)}</Text>
        <Text className="text-gray-500 text-xs">
          {printed.unit === null ? printed.value : `${printed.value} ${printed.unit}`}
        </Text>
      </View>
      {note !== '' && <Text className="text-gray-400 text-xs mt-1">{note}</Text>}
    </View>
  );
}

function ResultCard({row}: {row: SavedRow}) {
  const status = safeStatus(row.severity, row.direction);
  const statusText = status.ok ? STATUS_TEXT[status.status] : 'Could not show this result';
  const notRated = notRatedLabel({
    severity: row.severity,
    rangeBasis: row.range_basis,
    valueStd: row.value_std,
    refLow: row.ref_low,
    refHigh: row.ref_high,
    valueSource: row.value_source,
    canonicalCode: row.canonical_code,
  });
  const lines = [notRated, basisLine(row.severity, row.range_basis, row.normal_range), flagLabel(row.flag), sourceNote(row.value_source, row.ref_source), row.normal_range];
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
      <View className="flex-row justify-between items-center">
        <Text className="flex-1 text-gray-800 text-sm font-semibold">{row.test_name}</Text>
        {statusText !== '' && <Text className="text-teal-600 text-sm font-semibold">{statusText}</Text>}
      </View>
      <Text className="text-gray-600 text-sm mt-1">{row.unit === '' ? row.value : `${row.value} ${row.unit}`}</Text>
      {lines
        .filter(line => line !== '')
        .map((line, i) => (
          <Text key={i} className="text-gray-400 text-xs mt-1">
            {line}
          </Text>
        ))}
    </View>
  );
}

export default function EngineReviewScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {categoryId} = params;

  const [session] = useState(() => getSession());
  const [visitId] = useState(() => randomId());
  const [initialDate] = useState(() => prefillDate(session?.dateCandidate ?? null, new Date()));
  const [dateText, setDateText] = useState(initialDate);
  const [dateError, setDateError] = useState(false);
  const [stage, setStage] = useState<Stage>('date');
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<ReadData | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [sexNoticeCount, setSexNoticeCount] = useState(0);
  const [ranges, setRanges] = useState<{[index: number]: RangeText}>({});
  const [errors, setErrors] = useState<{[index: number]: string}>({});
  const [savedRows, setSavedRows] = useState<SavedRow[]>([]);
  const mounted = useRef(true);
  const pending = useRef<{cancel: () => void} | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pending.current !== null) {
        pending.current.cancel();
      }
      clearSession();
    };
  }, []);

  if (session === null || !session.payload) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
            <Text className="text-gray-600 text-xl">‹</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">Review Report</Text>
        </View>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-gray-800 text-base font-semibold">Nothing to review</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} className="bg-teal-500 rounded-xl px-6 py-3 mt-4">
            <Text className="text-white text-sm font-semibold">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const discard = () => {
    clearSession();
    navigation.goBack();
  };

  const onContinue = async () => {
    if (busy) {
      return;
    }
    if (!isVisitDate(dateText, new Date())) {
      setDateError(true);
      return;
    }
    setBusy(true);
    try {
      const loadedSex = await loadSex(database);
      const outcome = readPayload(session.payload, {visitId, visitDate: dateText, sex: loadedSex});
      if (!mounted.current) {
        return;
      }
      if (outcome.kind === 'date_required') {
        alertDateRequired();
      } else if (outcome.kind === 'could_not_read') {
        alertCouldNotRead();
      } else {
        setRead(outcome);
        setResults(outcome.record.results);
        setSexNoticeCount(loadedSex === null ? outcome.widestRangeCount : 0);
        setStage('review');
      }
    } catch {
      if (mounted.current) {
        alertCouldNotRead();
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
      }
    }
  };

  const changeRange = (index: number, field: 'low' | 'high', text: string) => {
    setRanges(prev => ({...prev, [index]: {...(prev[index] ?? {low: '', high: ''}), [field]: text}}));
    setErrors(prev => ({...prev, [index]: ''}));
  };

  const answerRange = (index: number, noRange: boolean) => {
    const typed = ranges[index] ?? {low: '', high: ''};
    const reject = (message: string) => setErrors(prev => ({...prev, [index]: message}));
    let low: number | null = null;
    let high: number | null = null;
    if (!noRange) {
      const lowParse = parseBound(typed.low);
      const highParse = parseBound(typed.high);
      if (lowParse.kind === 'invalid' || highParse.kind === 'invalid') {
        reject(RANGE_MESSAGES.engine_rejected);
        return;
      }
      low = lowParse.kind === 'number' ? lowParse.value : null;
      high = highParse.kind === 'number' ? highParse.value : null;
    }
    const check = checkRangeInput(low, high, noRange);
    if (!check.ok) {
      reject(RANGE_MESSAGES[check.reason]);
      return;
    }
    const answer = applyRangeAnswer(results[index], check.low, check.high);
    if (!answer.ok) {
      reject(RANGE_MESSAGES.engine_rejected);
      return;
    }
    setResults(prev => prev.map((row, i) => (i === index ? answer.row : row)));
    setRanges(prev => ({...prev, [index]: {low: '', high: ''}}));
    setErrors(prev => ({...prev, [index]: ''}));
  };

  const skipRange = (index: number) => {
    setRanges(prev => ({...prev, [index]: {low: '', high: ''}}));
    setErrors(prev => ({...prev, [index]: ''}));
  };

  const failSave = () => {
    if (mounted.current) {
      setBusy(false);
      alertCouldNotSave();
    }
  };

  const runSave = async (data: ReadData) => {
    try {
      const history = buildHistory(await loadHistoryRows(database), dateText);
      const scored = scoreRows(results, dateText, history);
      const saved = toSavedReport(scored, data.record);
      if (saved.kind !== 'saved') {
        failSave();
        return;
      }
      await saveEngineReport(database, saved, {visitId, categoryId});
      clearSession();
      if (mounted.current) {
        setSavedRows(saved.rows);
        setStage('saved');
        setBusy(false);
      }
    } catch {
      failSave();
    }
  };

  const onSave = () => {
    if (busy || read === null) {
      return;
    }
    const data = read;
    setBusy(true);
    pending.current = InteractionManager.runAfterInteractions(() => {
      pending.current = null;
      runSave(data).catch(failSave);
    });
  };

  const header = (
    <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
      <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy} className="p-2 mr-2">
        <Text className="text-gray-600 text-xl">‹</Text>
      </TouchableOpacity>
      <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">Review Report</Text>
    </View>
  );

  if (stage === 'date') {
    const prefilled = initialDate !== '' && dateText === initialDate;
    return (
      <SafeAreaView className="flex-1 bg-white">
        {header}
        <View className="px-4 pt-6">
          <Text className="text-gray-800 text-sm font-semibold mb-1">
            {prefilled ? 'Found on your report: confirm' : 'Date of the report'}
          </Text>
          <TextInput
            value={dateText}
            onChangeText={text => {
              setDateText(text);
              setDateError(false);
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            editable={!busy}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm"
          />
          {dateError && <Text className="text-red-500 text-xs mt-2">{DATE_MESSAGE}</Text>}
          <TouchableOpacity
            onPress={onContinue}
            disabled={busy}
            className="bg-teal-500 rounded-xl py-3 items-center mt-4">
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white text-sm font-semibold">Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={discard} disabled={busy} className="py-3 items-center mt-1">
            <Text className="text-gray-500 text-sm">Discard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'saved') {
    return (
      <SafeAreaView className="flex-1 bg-white">
        {header}
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {savedRows.map(row => (
            <ResultCard key={row.position} row={row} />
          ))}
          <TouchableOpacity
            onPress={() => navigation.popToTop()}
            className="bg-teal-500 rounded-xl py-3 items-center mt-2 mb-8">
            <Text className="text-white text-sm font-semibold">Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const supported = (index: number) => results[index].supported === true;
  const openReasons = (index: number) => reviewReasons(results[index]);
  const reviewList = (read === null ? [] : read.reviewIndexes).filter(i => supported(i) && openReasons(i).length > 0);
  const readyList = results.map((_, i) => i).filter(i => supported(i) && !reviewList.includes(i));
  const unsupportedCount = read === null ? 0 : read.unsupportedCount;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {header}
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {sexNoticeCount > 0 && (
          <Notice
            text={
              'Your report prints separate ranges for men and women. Your sex is not set in Profile, so the widest ' +
              `printed range was used for ${sexNoticeCount} result(s). A result outside the range for your sex can ` +
              'show as normal here. Set your sex in Profile, then scan the report again.'
            }
          />
        )}
        {unsupportedCount > 0 && (
          <Notice text={`${unsupportedCount} result(s) not scored and not saved; add them by manual entry if needed.`} />
        )}
        {reviewList.map(index => (
          <ReviewCard
            key={index}
            row={results[index]}
            reasons={openReasons(index)}
            range={ranges[index] ?? {low: '', high: ''}}
            error={errors[index] ?? ''}
            disabled={busy}
            onChange={(field, text) => changeRange(index, field, text)}
            onUseRange={() => answerRange(index, false)}
            onNoRange={() => answerRange(index, true)}
            onSkip={() => skipRange(index)}
          />
        ))}
        {readyList.length > 0 && (
          <View className="bg-white rounded-2xl px-4 py-2 mb-3 border border-gray-100">
            {readyList.map(index => (
              <ReadyLine key={index} row={results[index]} />
            ))}
          </View>
        )}
        <TouchableOpacity onPress={onSave} disabled={busy} className="bg-teal-500 rounded-xl py-3 items-center mt-2">
          {busy ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white text-sm font-semibold">Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={discard} disabled={busy} className="py-3 items-center mt-1 mb-8">
          <Text className="text-gray-500 text-sm">Discard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
