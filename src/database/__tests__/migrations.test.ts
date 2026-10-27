// MOB-03 step 10: schema version 7 and its migration (rows MG1 and PV4 of the plan).
// The tests read the real schema and migrations and compare them with a frozen copy of version 6
// and with literal lists written out here, so a change to either side shows up as a failure.
import * as fs from 'fs';
import * as path from 'path';
import type {AppSchema, ColumnSchema, TableSchema} from '@nozbe/watermelondb';
import {sanitizedRaw} from '@nozbe/watermelondb/RawRecord';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import logger from '@nozbe/watermelondb/utils/common/logger';
import {schema} from '../schema';
import {migrations} from '../schema/migrations';
import {schemaV6} from './fixtures/schema_v6';

interface ColumnShape {
  type: string;
  isOptional: boolean;
  isIndexed: boolean;
}

type ColumnShapes = Record<string, ColumnShape>;

interface AddColumnsStep {
  type: 'add_columns';
  table: string;
  columns: ColumnSchema[];
}

interface CreateTableStep {
  type: 'create_table';
  schema: TableSchema;
}

type Step = AddColumnsStep | CreateTableStep | {type: string};

const shapeOf = (column: ColumnSchema): ColumnShape => ({
  type: column.type,
  isOptional: column.isOptional === true,
  isIndexed: column.isIndexed === true,
});

const shapesOf = (columns: ColumnSchema[]): ColumnShapes => {
  const out: ColumnShapes = {};
  columns.forEach(c => {
    out[c.name] = shapeOf(c);
  });
  return out;
};

const tableShapes = (s: AppSchema, table: string): ColumnShapes =>
  shapesOf(s.tables[table].columnArray);

const migrationList = (): Array<{toVersion: number; steps: Step[]}> =>
  (migrations as unknown as {sortedMigrations: Array<{toVersion: number; steps: Step[]}>})
    .sortedMigrations;

const steps = (): Step[] => migrationList()[0].steps;

const addedColumnsByTable = (): Record<string, ColumnShapes> => {
  const out: Record<string, ColumnShapes> = {};
  steps().forEach(step => {
    if (step.type === 'add_columns') {
      const s = step as AddColumnsStep;
      out[s.table] = {...(out[s.table] ?? {}), ...shapesOf(s.columns)};
    }
  });
  return out;
};

const createdTables = (): Record<string, ColumnShapes> => {
  const out: Record<string, ColumnShapes> = {};
  steps().forEach(step => {
    if (step.type === 'create_table') {
      const s = step as CreateTableStep;
      out[s.schema.name] = shapesOf(s.schema.columnArray);
    }
  });
  return out;
};

const opt = (type: string, isIndexed = false): ColumnShape => ({
  type,
  isOptional: true,
  isIndexed,
});

// The 14 + 4 new columns of plan 6.3, written out in full (not computed from the code under test).
const TEST_RESULT_NEW: string[] = [
  'canonical_code',
  'severity',
  'direction',
  'range_basis',
  'result_type',
  'value_std',
  'ref_low',
  'ref_high',
  'ref_source',
  'value_source',
  'position',
  'confidence',
  'review_reasons',
  'flag',
];

const CHECKUP_REPORT_NEW: string[] = [
  'contract_b',
  'parser_version',
  'dictionary_version',
  'visit_day',
];

const EXPECTED_TEST_RESULT_NEW: ColumnShapes = {
  canonical_code: opt('string', true),
  severity: opt('string'),
  direction: opt('string'),
  range_basis: opt('string'),
  result_type: opt('string'),
  value_std: opt('number'),
  ref_low: opt('number'),
  ref_high: opt('number'),
  ref_source: opt('string'),
  value_source: opt('string'),
  position: opt('number'),
  confidence: opt('number'),
  review_reasons: opt('string'),
  flag: opt('string'),
};

const EXPECTED_CHECKUP_REPORT_NEW: ColumnShapes = {
  contract_b: opt('string'),
  parser_version: opt('string'),
  dictionary_version: opt('string'),
  visit_day: opt('string', true),
};

const EXPECTED_APP_SETTINGS: ColumnShapes = {
  key: {type: 'string', isOptional: false, isIndexed: true},
  value: {type: 'string', isOptional: true, isIndexed: false},
  updated_at: {type: 'number', isOptional: false, isIndexed: false},
};

describe('MG1: schema 7 and its migration', () => {
  test('schema version is 7 and the frozen copy is version 6', () => {
    expect(schema.version).toBe(7);
    expect(schemaV6.version).toBe(6);
  });

  test('there is exactly one migration, to version 7', () => {
    const list = migrationList();
    expect(list).toHaveLength(1);
    expect(list[0].toVersion).toBe(7);
  });

  test('the migration has only addColumns and createTable steps, one for each table named in the plan', () => {
    const kinds = steps().map(s => s.type);
    expect(kinds.filter(k => k === 'add_columns')).toHaveLength(2);
    expect(kinds.filter(k => k === 'create_table')).toHaveLength(1);
    expect(kinds).toHaveLength(3);
    expect(Object.keys(addedColumnsByTable()).sort()).toEqual(['checkup_reports', 'test_results']);
  });

  test('the literal lists have 14 and 4 distinct names', () => {
    expect(new Set(TEST_RESULT_NEW).size).toBe(14);
    expect(new Set(CHECKUP_REPORT_NEW).size).toBe(4);
    expect(Object.keys(EXPECTED_TEST_RESULT_NEW).sort()).toEqual([...TEST_RESULT_NEW].sort());
    expect(Object.keys(EXPECTED_CHECKUP_REPORT_NEW).sort()).toEqual([...CHECKUP_REPORT_NEW].sort());
  });

  test('test_results gains exactly the 14 columns, with the listed types and flags', () => {
    const added = addedColumnsByTable().test_results;
    expect(Object.keys(added).sort()).toEqual([...TEST_RESULT_NEW].sort());
    expect(added).toEqual(EXPECTED_TEST_RESULT_NEW);
  });

  test('checkup_reports gains exactly the 4 columns, with the listed types and flags', () => {
    const added = addedColumnsByTable().checkup_reports;
    expect(Object.keys(added).sort()).toEqual([...CHECKUP_REPORT_NEW].sort());
    expect(added).toEqual(EXPECTED_CHECKUP_REPORT_NEW);
  });

  test('the migration creates only app_settings, with key, value and updated_at as listed', () => {
    const created = createdTables();
    expect(Object.keys(created)).toEqual(['app_settings']);
    expect(created.app_settings).toEqual(EXPECTED_APP_SETTINGS);
  });

  test('every column added by the migration is optional, except app_settings key and updated_at', () => {
    const required: string[] = [];
    Object.entries(addedColumnsByTable()).forEach(([table, cols]) => {
      Object.entries(cols).forEach(([name, shape]) => {
        if (!shape.isOptional) {
          required.push(`${table}.${name}`);
        }
      });
    });
    Object.entries(createdTables().app_settings).forEach(([name, shape]) => {
      if (!shape.isOptional) {
        required.push(`app_settings.${name}`);
      }
    });
    expect(required.sort()).toEqual(['app_settings.key', 'app_settings.updated_at']);
  });

  test('schema 7 minus schema 6 (tables and columns) equals what the migration adds', () => {
    const v6Tables = Object.keys(schemaV6.tables);
    const v7Tables = Object.keys(schema.tables);

    const newTables = v7Tables.filter(t => !v6Tables.includes(t)).sort();
    expect(newTables).toEqual(Object.keys(createdTables()).sort());
    expect(v6Tables.filter(t => !v7Tables.includes(t))).toEqual([]);

    // Columns of the new tables match the created table exactly.
    newTables.forEach(t => {
      expect(tableShapes(schema, t)).toEqual(createdTables()[t]);
    });

    // For tables present in both, the new columns match the addColumns steps exactly.
    const added = addedColumnsByTable();
    v6Tables.forEach(t => {
      const before = tableShapes(schemaV6, t);
      const after = tableShapes(schema, t);
      const diff: ColumnShapes = {};
      Object.keys(after).forEach(name => {
        if (!(name in before)) {
          diff[name] = after[name];
        }
      });
      // No column of version 6 was removed or changed.
      Object.keys(before).forEach(name => {
        expect(after[name]).toEqual(before[name]);
      });
      expect(diff).toEqual(added[t] ?? {});
    });
  });

  test('every other table equals its version 6 definition', () => {
    const changed = ['test_results', 'checkup_reports'];
    Object.keys(schemaV6.tables)
      .filter(t => !changed.includes(t))
      .forEach(t => {
        expect(schema.tables[t].columnArray).toEqual(schemaV6.tables[t].columnArray);
      });
  });

  test('src/database/index.ts passes migrations to the adapter and lists AppSetting in modelClasses', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf-8');
    const adapterOptions = /new SQLiteAdapter\(\{([\s\S]*?)\}\);/.exec(source);
    expect(adapterOptions).not.toBeNull();
    expect(adapterOptions![1]).toMatch(/\bmigrations\b/);
    const modelClasses = /modelClasses:\s*\[([^\]]*)\]/.exec(source);
    expect(modelClasses).not.toBeNull();
    expect(modelClasses![1]).toMatch(/\bAppSetting\b/);
  });
});

describe('PV4: no image is stored', () => {
  test('no column name in any table of schema 7 matches image, photo, uri or path', () => {
    const names: string[] = [];
    Object.values(schema.tables).forEach(t => {
      t.columnArray.forEach(c => names.push(`${t.name}.${c.name}`));
    });
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter(n => /image|photo|uri|path/i.test(n.split('.')[1]))).toEqual([]);
  });
});

describe('models load under the database project', () => {
  test('the three models have the expected table names', () => {
    // Required here so that a failure to load the decorators shows as one failing test.
    const TestResult = require('../models/TestResult').default;
    const CheckupReport = require('../models/CheckupReport').default;
    const AppSetting = require('../models/AppSetting').default;
    expect(TestResult.table).toBe('test_results');
    expect(CheckupReport.table).toBe('checkup_reports');
    expect(AppSetting.table).toBe('app_settings');
  });
});

type Result<T> = {value: T} | {error: Error};

const call = <T>(fn: (cb: (result: Result<T>) => void) => void): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    fn(result => {
      if ('error' in result) {
        reject(result.error);
      } else {
        resolve(result.value);
      }
    });
  });

describe('upgrade from version 6 on a LokiJS database', () => {
  test('a legacy report survives the migration and the new table and columns exist', async () => {
    logger.silence(); // WatermelonDB logs every adapter step and a deprecation warning for the Loki options
    const options = {useWebWorker: false, useIncrementalIndexedDB: false, dbName: 'upgrade_test'};
    const v6Adapter = new LokiJSAdapter({...options, schema: schemaV6});

    const legacy = sanitizedRaw(
      {id: 'legacy1', category_id: 'clinical', checkup_date: 1, created_at: 1, updated_at: 1},
      schemaV6.tables.checkup_reports,
    );
    await call<void>(cb => v6Adapter.batch([['create', 'checkup_reports', legacy]], cb));
    const legacyResult = sanitizedRaw(
      {id: 'legacyr1', report_id: 'legacy1', test_name: 'X', unit: 'u', normal_range: '1-2', value: '3', status: 'high', created_at: 1},
      schemaV6.tables.test_results,
    );
    await call<void>(cb => v6Adapter.batch([['create', 'test_results', legacyResult]], cb));

    // Reopen the same in-memory store at version 7 with the migration.
    const v7Adapter = await v6Adapter.testClone({schema, migrations});

    const report = await call<any>(cb => v7Adapter.find('checkup_reports', 'legacy1', cb));
    expect(report.category_id).toBe('clinical');
    CHECKUP_REPORT_NEW.forEach(name => expect(report[name]).toBeNull());

    const row = await call<any>(cb => v7Adapter.find('test_results', 'legacyr1', cb));
    expect(row.status).toBe('high');
    TEST_RESULT_NEW.forEach(name => expect(row[name]).toBeNull());

    // The new table accepts a record. Read it back from the Loki collection (find would return only the cached id).
    const setting = sanitizedRaw(
      {id: 's1', key: 'sex', value: null, updated_at: 1},
      schema.tables.app_settings,
    );
    await call<void>(cb => v7Adapter.batch([['create', 'app_settings', setting]], cb));
    let stored: any = null;
    await call<void>(cb =>
      v7Adapter.unsafeExecute(
        {
          loki: (loki: any) => {
            stored = loki.getCollection('app_settings').by('id', 's1');
            loki.close(); // stops the autosave timer so that Jest can exit
          },
        } as any,
        cb,
      ),
    );
    expect(stored.key).toBe('sex');
    expect(stored.value).toBeNull();
  });
});
