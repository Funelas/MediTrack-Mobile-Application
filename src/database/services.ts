import {database} from './index';
import Medicine from './models/Medicine';
import IntakeLog from './models/IntakeLog';
import Schedule from './models/Schedule';
import CheckupReport from './models/CheckupReport';
import TestResult from './models/TestResult';

const medicines = database.get<Medicine>('medicines');
const intakeLogs = database.get<IntakeLog>('intake_logs');
const schedules = database.get<Schedule>('schedules');
const checkupReports = database.get<CheckupReport>('checkup_reports');
const testResults = database.get<TestResult>('test_results');

// --- Medicine ---
export const getMedicines = () => medicines.query().fetch();

export const addMedicine = async (data: {
  name: string;
  genericName?: string;
  manufacturer?: string;
  color: string;
  form: string;
  dosage: string;
  intakeTimes: string[];        // e.g. ["08:00", "20:00"]
  startDate: Date;
  repeat: string;               // JSON string
  endsType: string;             // "never" | "on_date" | "after_occurrences"
  endDate?: number;
  occurrences?: number;
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
      med.startDate = data.startDate;
      med.repeat = data.repeat;
      med.endsType = data.endsType;
      med.endDate = data.endDate ?? 0;
      med.occurrences = data.occurrences ?? 0;
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

// --- Intake Logs ---
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
  intakeLogs.query().fetch();

// --- Schedules ---
export const getSchedules = async () => {
  const results = await schedules.query().fetch();
  console.log('[DB] Schedules:', JSON.stringify(results.map(s => ({
    id: s.id, title: s.title, type: s.type,
    date: new Date(s.date).toISOString(),
    time: new Date(s.time).toISOString(),
    isDone: s.isDone,
  })), null, 2));
  return results;
};

export const addSchedule = async (data: {
  title: string;
  type: 'appointment' | 'reminder';
  date: Date;
  time: Date;
  repeat: string;
  reminder: string;
  notes?: string;
  doctorClinic?: string;
  location?: string;
}) => {
  return database.write(async () => {
    return schedules.create(s => {
      s.title = data.title;
      s.type = data.type;
      s.date = data.date;
      s.time = data.time;
      s.repeat = data.repeat;
      s.reminder = data.reminder;
      s.notes = data.notes ?? '';
      s.doctorClinic = data.doctorClinic ?? '';
      s.location = data.location ?? '';
      s.isDone = false;
      (s as any)._raw.created_at = Date.now();
      (s as any)._raw.updated_at = Date.now();
    });
  });
};

export const toggleScheduleDone = async (schedule: Schedule) => {
  return database.write(async () => {
    return schedule.update(s => {
      s.isDone = !s.isDone;
    });
  });
};

export const deleteSchedule = async (schedule: Schedule) => {
  return database.write(async () => {
    return schedule.markAsDeleted();
  });
};

// --- Checkup Reports ---
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
