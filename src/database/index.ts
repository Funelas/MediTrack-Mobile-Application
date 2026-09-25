import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {schema} from './schema';
import Medicine from './models/Medicine';
import IntakeLog from './models/IntakeLog';
import Task from './models/Task';
import Occurrence from './models/Occurrence';
import CheckupReport from './models/CheckupReport';
import TestResult from './models/TestResult';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'meditrack',
  jsi: false,
  onSetUpError: error => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Medicine, IntakeLog, Task, Occurrence, CheckupReport, TestResult],
});
