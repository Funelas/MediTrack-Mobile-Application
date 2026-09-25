import {database} from './index';
import Medicine from './models/Medicine';
import IntakeLog from './models/IntakeLog';
import Task from './models/Task';
import Occurrence from './models/Occurrence';
import CheckupReport from './models/CheckupReport';
import TestResult from './models/TestResult';
import {Q} from '@nozbe/watermelondb';

const medicines = database.get<Medicine>('medicines');
const intakeLogs = database.get<IntakeLog>('intake_logs');
const tasks = database.get<Task>('tasks');
const occurrences = database.get<Occurrence>('occurrences');
const checkupReports = database.get<CheckupReport>('checkup_reports');
const testResults = database.get<TestResult>('test_results');

// ─── RRULE helpers ────────────────────────────────────────────────────────────

// Day-of-week abbreviations used in RRULE BYDAY vs JS getDay()
const BYDAY_TO_JS: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

// Convert our UI day strings ("Mon","Tue"...) to RRULE BYDAY tokens
const UI_DAY_TO_BYDAY: Record<string, string> = {
  Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE',
  Thu: 'TH', Fri: 'FR', Sat: 'SA',
};

/**
 * Convert the UI repeat selection from AddScheduleScreen / AddMedicineScreen
 * into a proper RRULE string.
 *
 * repeatType: "Every Day" | "Every week" | "Every month" | "Does not repeat" | "Custom"
 * repeatDays: string[] of UI day names e.g. ["Mon","Wed"] (only for Custom)
 */
export function buildRRule(
  repeatType: string,
  repeatDays: string[] = [],
  endsType: string = 'never',
  occurrencesCount?: number,
  endDate?: number,
): string {
  let base = '';

  switch (repeatType) {
    case 'Every day':
    case 'Every Day':
      base = 'FREQ=DAILY';
      break;
    case 'Every week':
      base = 'FREQ=WEEKLY';
      break;
    case 'Every month':
      base = 'FREQ=MONTHLY';
      break;
    case 'Does not repeat':
      base = 'FREQ=DAILY;COUNT=1';
      break;
    case 'Custom':
      if (repeatDays.length > 0) {
        const byDay = repeatDays.map(d => UI_DAY_TO_BYDAY[d] ?? d).join(',');
        base = `FREQ=WEEKLY;BYDAY=${byDay}`;
      } else {
        base = 'FREQ=DAILY';
      }
      break;
    default:
      base = 'FREQ=DAILY;COUNT=1';
  }

  // ends modifiers (skip if COUNT=1 already set for one-off)
  if (!base.includes('COUNT=1')) {
    if (endsType === 'after_occurrences' && occurrencesCount) {
      base += `;COUNT=${occurrencesCount}`;
    } else if (endsType === 'on_date' && endDate) {
      const d = new Date(endDate);
      const until = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      base += `;UNTIL=${until}`;
    }
  }

  return base;
}

/**
 * Parse an RRULE string into a plain object.
 */
function parseRRule(rrule: string): Record<string, string> {
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  return parts;
}

/**
 * Return midnight (00:00:00.000) of a given date as a new Date.
 */
function midnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

/**
 * Expand an RRULE against a date range [rangeStart, rangeEnd] (both inclusive).
 * Returns an array of midnight Date objects that fall within the range.
 *
 * startDate — the first possible occurrence date (rule anchor)
 * rrule     — RRULE string e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"
 */
export function expandRRule(startDate: Date, rrule: string, rangeStart: Date, rangeEnd: Date): Date[] {
  const rule = parseRRule(rrule);
  const freq = rule['FREQ'] ?? 'DAILY';
  const count = rule['COUNT'] ? parseInt(rule['COUNT']) : undefined;
  const until = rule['UNTIL']
    ? new Date(
        parseInt(rule['UNTIL'].slice(0, 4)),
        parseInt(rule['UNTIL'].slice(4, 6)) - 1,
        parseInt(rule['UNTIL'].slice(6, 8)),
      )
    : undefined;
  const byDay: number[] | undefined = rule['BYDAY']
    ? rule['BYDAY'].split(',').map(d => BYDAY_TO_JS[d.trim()]).filter(n => n !== undefined)
    : undefined;

  const results: Date[] = [];
  const anchor = midnight(startDate);
  const end = midnight(rangeEnd);
  const start = midnight(rangeStart);

  // Hard cap: never iterate more than 3 years of daily ticks (~1100 steps)
  const MAX_STEPS = 1200;
  let steps = 0;
  let occurrenceCount = 0;
  let cursor = new Date(anchor);

  while (cursor <= end && steps < MAX_STEPS) {
    steps++;

    // Stop if we've hit the UNTIL boundary
    if (until && cursor > midnight(until)) break;

    // Check if this cursor date is a valid occurrence day
    let isValid = false;
    if (byDay) {
      isValid = byDay.includes(cursor.getDay());
    } else {
      // For DAILY / MONTHLY we check cadence from anchor
      if (freq === 'DAILY') {
        isValid = true;
      } else if (freq === 'WEEKLY') {
        const diffDays = Math.round((cursor.getTime() - anchor.getTime()) / 86400000);
        isValid = diffDays % 7 === 0;
      } else if (freq === 'MONTHLY') {
        isValid = cursor.getDate() === anchor.getDate();
      }
    }

    if (isValid && cursor >= anchor) {
      occurrenceCount++;
      if (count !== undefined && occurrenceCount > count) break;
      if (cursor >= start) {
        results.push(new Date(cursor));
      }
    }

    // Advance cursor by the right step size
    if (freq === 'MONTHLY') {
      cursor = new Date(cursor);
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor = new Date(cursor.getTime() + 86400000); // +1 day
    }
  }

  return results;
}

// ─── VirtualItem — the unified type returned by getItemsForDateRange ──────────

export type VirtualItem = {
  /** Unique key for React lists: "<referenceId>-<scheduledDate>-<scheduledTime>" */
  key: string;
  referenceId: string;
  referenceType: 'task' | 'med';
  title: string;
  type: string;           // "reminder" | "appointment" | "med"
  date: Date;             // the calendar day (midnight)
  time: string;           // "HH:MM" 24h
  isDone: boolean;
  isCancelled: boolean;
  snoozedUntil: number;
  // task-specific
  doctorClinic?: string;
  location?: string;
  notes?: string;
  reminder?: string;
  rrule?: string;
  // med-specific
  color?: string;
  dosage?: string;
  form?: string;
};

/**
 * Core read function used by HomeScreen and ScheduleScreen.
 *
 * Expands all task and medicine rules for the given date range,
 * then overlays the occurrences table to apply done/cancelled state.
 */
export async function getItemsForDateRange(rangeStart: Date, rangeEnd: Date): Promise<VirtualItem[]> {
  const [allTasks, allMedicines, allOccurrences] = await Promise.all([
    tasks.query().fetch(),
    medicines.query().fetch(),
    occurrences
      .query(
        Q.and(
          Q.where('scheduled_date', Q.gte(midnight(rangeStart).getTime())),
          Q.where('scheduled_date', Q.lte(midnight(rangeEnd).getTime())),
        ),
      )
      .fetch(),
  ]);

  const virtual: VirtualItem[] = [];

  // ── expand tasks ──
  for (const task of allTasks) {
    const dates = expandRRule(new Date(task.startDate), task.rrule, rangeStart, rangeEnd);
    for (const date of dates) {
      const key = `${task.id}-${date.getTime()}-${task.time}`;
      virtual.push({
        key,
        referenceId: task.id,
        referenceType: 'task',
        title: task.title,
        type: task.type,
        date,
        time: task.time,
        isDone: false,
        isCancelled: false,
        snoozedUntil: 0,
        doctorClinic: task.doctorClinic,
        location: task.location,
        notes: task.notes,
        reminder: task.reminder,
        rrule: task.rrule,
      });
    }
  }

  // ── expand medicines ──
  for (const med of allMedicines) {
    const dates = expandRRule(new Date(med.startDate), med.rrule, rangeStart, rangeEnd);
    const intakeTimes = med.parsedIntakeTimes;
    for (const date of dates) {
      for (const time of intakeTimes) {
        const key = `${med.id}-${date.getTime()}-${time}`;
        virtual.push({
          key,
          referenceId: med.id,
          referenceType: 'med',
          title: med.name,
          type: 'med',
          date,
          time,
          isDone: false,
          isCancelled: false,
          snoozedUntil: 0,
          notes: `${med.dosage} · ${med.form}`,
          color: med.color,
          dosage: med.dosage,
          form: med.form,
        });
      }
    }
  }

  // ── overlay occurrences ──
  for (const occ of allOccurrences) {
    const occDate = midnight(new Date(occ.scheduledDate));
    const match = virtual.find(
      v =>
        v.referenceId === occ.referenceId &&
        v.date.getTime() === occDate.getTime() &&
        v.time === occ.scheduledTime,
    );
    if (match) {
      match.isDone = occ.isDone;
      match.isCancelled = occ.isCancelled;
      match.snoozedUntil = occ.snoozedUntil ?? 0;
    }
  }

  return virtual
    .filter(v => !v.isCancelled)
    .sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
}

/**
 * Convenience wrapper: items for a single day.
 */
export async function getItemsForDay(day: Date): Promise<VirtualItem[]> {
  return getItemsForDateRange(day, day);
}

// ─── Occurrence writes ────────────────────────────────────────────────────────

/**
 * Find an existing occurrence row or create one, then apply the update.
 * This is the single entry point for marking done, cancelling, or snoozing.
 */
export async function upsertOccurrence(
  referenceId: string,
  referenceType: 'task' | 'med',
  scheduledDate: Date,
  scheduledTime: string,
  update: {isDone?: boolean; isCancelled?: boolean; snoozedUntil?: number},
): Promise<void> {
  const dayStart = midnight(scheduledDate).getTime();

  const existing = await occurrences
    .query(
      Q.and(
        Q.where('reference_id', referenceId),
        Q.where('scheduled_date', dayStart),
        Q.where('scheduled_time', scheduledTime),
      ),
    )
    .fetch();

  await database.write(async () => {
    if (existing.length > 0) {
      await existing[0].update(occ => {
        if (update.isDone !== undefined) occ.isDone = update.isDone!;
        if (update.isCancelled !== undefined) occ.isCancelled = update.isCancelled!;
        if (update.snoozedUntil !== undefined) occ.snoozedUntil = update.snoozedUntil!;
      });
    } else {
      await occurrences.create(occ => {
        occ.referenceId = referenceId;
        occ.referenceType = referenceType;
        (occ as any)._raw.scheduled_date = dayStart;
        occ.scheduledTime = scheduledTime;
        occ.isDone = update.isDone ?? false;
        occ.isCancelled = update.isCancelled ?? false;
        occ.snoozedUntil = update.snoozedUntil ?? 0;
        (occ as any)._raw.created_at = Date.now();
      });
    }
  });
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export const getTasks = () => tasks.query().fetch();

export const addTask = async (data: {
  title: string;
  type: 'appointment' | 'reminder';
  startDate: Date;
  time: string;           // "HH:MM"
  rrule: string;
  endsType: string;
  endDate?: number;
  occurrencesCount?: number;
  reminder: string;
  notes?: string;
  doctorClinic?: string;
  location?: string;
}) => {
  return database.write(async () => {
    return tasks.create(t => {
      t.title = data.title;
      t.type = data.type;
      (t as any)._raw.start_date = data.startDate.getTime();
      t.time = data.time;
      t.rrule = data.rrule;
      t.endsType = data.endsType;
      t.endDate = data.endDate ?? 0;
      t.occurrencesCount = data.occurrencesCount ?? 0;
      t.reminder = data.reminder;
      t.notes = data.notes ?? '';
      t.doctorClinic = data.doctorClinic ?? '';
      t.location = data.location ?? '';
      (t as any)._raw.created_at = Date.now();
      (t as any)._raw.updated_at = Date.now();
    });
  });
};

export const updateTask = async (task: Task, data: Partial<{
  title: string;
  type: string;
  startDate: Date;
  time: string;
  rrule: string;
  endsType: string;
  endDate: number;
  occurrencesCount: number;
  reminder: string;
  notes: string;
  doctorClinic: string;
  location: string;
}>) => {
  return database.write(async () => {
    return task.update(t => {
      if (data.title !== undefined) t.title = data.title;
      if (data.type !== undefined) t.type = data.type;
      if (data.startDate !== undefined) (t as any)._raw.start_date = data.startDate.getTime();
      if (data.time !== undefined) t.time = data.time;
      if (data.rrule !== undefined) t.rrule = data.rrule;
      if (data.endsType !== undefined) t.endsType = data.endsType;
      if (data.endDate !== undefined) t.endDate = data.endDate;
      if (data.occurrencesCount !== undefined) t.occurrencesCount = data.occurrencesCount;
      if (data.reminder !== undefined) t.reminder = data.reminder;
      if (data.notes !== undefined) t.notes = data.notes;
      if (data.doctorClinic !== undefined) t.doctorClinic = data.doctorClinic;
      if (data.location !== undefined) t.location = data.location;
      (t as any)._raw.updated_at = Date.now();
    });
  });
};

export const deleteTask = async (task: Task) => {
  return database.write(async () => {
    return task.markAsDeleted();
  });
};

// ─── Medicine CRUD ────────────────────────────────────────────────────────────

export const getMedicines = () => medicines.query().fetch();

export const addMedicine = async (data: {
  name: string;
  genericName?: string;
  manufacturer?: string;
  color: string;
  form: string;
  dosage: string;
  intakeTimes: string[];      // ["08:00", "20:00"]
  startDate: Date;
  rrule: string;
  endsType: string;
  endDate?: number;
  occurrencesCount?: number;
  reminderEnabled: boolean;
  currentStock: number;
  maxStock: number;
  lowStockAlert: boolean;
  lowStockThreshold: number;
  trackingMethod: string;
}) => {
  return database.write(async () => {
    return medicines.create(med => {
      med.name = data.name;
      med.genericName = data.genericName ?? '';
      med.manufacturer = data.manufacturer ?? '';
      med.color = data.color;
      med.form = data.form;
      med.dosage = data.dosage;
      med.intakeTimes = JSON.stringify(data.intakeTimes);
      (med as any)._raw.start_date = data.startDate.getTime();
      med.rrule = data.rrule;
      med.endsType = data.endsType;
      med.endDate = data.endDate ?? 0;
      med.occurrencesCount = data.occurrencesCount ?? 0;
      med.reminderEnabled = data.reminderEnabled;
      med.currentStock = data.currentStock;
      med.maxStock = data.maxStock;
      med.lowStockAlert = data.lowStockAlert;
      med.lowStockThreshold = data.lowStockThreshold;
      med.trackingMethod = data.trackingMethod;
      (med as any)._raw.created_at = Date.now();
      (med as any)._raw.updated_at = Date.now();
    });
  });
};

export const updateMedicine = async (medicine: Medicine, data: Partial<Medicine>) => {
  return database.write(async () => {
    return medicine.update(med => {
      Object.assign(med, data);
    });
  });
};

export const deleteMedicine = async (medicine: Medicine) => {
  return database.write(async () => {
    return medicine.markAsDeleted();
  });
};

// ─── Intake Logs ──────────────────────────────────────────────────────────────

export const logIntake = async (medicineId: string, status: 'taken' | 'skipped' | 'snoozed') => {
  return database.write(async () => {
    return intakeLogs.create(log => {
      log.medicineId = medicineId;
      log.takenAt = new Date();
      log.status = status;
    });
  });
};

export const getIntakeLogsForMedicine = (medicineId: string) =>
  intakeLogs.query(Q.where('medicine_id', medicineId)).fetch();

// ─── Checkup Reports ──────────────────────────────────────────────────────────

export const getCheckupReports = () => checkupReports.query().fetch();

export const addCheckupReport = async (data: {
  category: string;
  checkupDate: Date;
  results: {
    testName: string;
    unit: string;
    normalRange: string;
    value: string;
    status: 'normal' | 'high' | 'low';
  }[];
}) => {
  return database.write(async () => {
    const report = await checkupReports.create(r => {
      r.category = data.category;
      r.checkupDate = data.checkupDate;
    });
    for (const result of data.results) {
      await testResults.create(t => {
        t.reportId = report.id;
        t.testName = result.testName;
        t.unit = result.unit;
        t.normalRange = result.normalRange;
        t.value = result.value;
        t.status = result.status;
      });
    }
    return report;
  });
};
