// MOB-03 step 12: loadSex and saveSex on a LokiJS database at schema version 7 (rows SX1 and SX5 of the plan). The stored values
// are typed here and written straight into the table, so that text that saveSex would never write (such as 'Male') can be read.
// Every database is closed after its test, so that LokiJS's autosave timer does not keep Node alive.
import {Database, Q} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import logger from '@nozbe/watermelondb/utils/common/logger';
import AppSetting from '../models/AppSetting';
import {schema} from '../schema';
import {loadSex, saveSex} from '../settings';

const open: Database[] = [];
let counter = 0;

function makeDb(): Database {
  logger.silence(); // WatermelonDB logs every adapter step and a deprecation warning for the Loki options
  counter += 1;
  const adapter = new LokiJSAdapter({
    schema,
    dbName: 'settings_test_' + String(counter),
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  const db = new Database({adapter, modelClasses: [AppSetting]});
  open.push(db);
  return db;
}

function closeDb(db: Database): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    (db.adapter as any).underlyingAdapter.unsafeExecute(
      {
        loki: (loki: any) => {
          loki.close(); // stops the autosave timer so that Jest can exit
        },
      },
      (result: any) => ('error' in result ? reject(result.error) : resolve()),
    );
  });
}

afterEach(async () => {
  const dbs = open.splice(0, open.length);
  for (const db of dbs) {
    await closeDb(db);
  }
});

/** Writes a row of the table directly (bypassing saveSex). */
async function store(db: Database, key: string, value: string | null): Promise<void> {
  await db.write(async () => {
    await db.get<AppSetting>('app_settings').create(row => {
      row.key = key;
      row.value = value;
      row.updatedAt = new Date(2026, 0, 1);
    });
  });
}

async function sexRowCount(db: Database): Promise<number> {
  return db.get<AppSetting>('app_settings').query(Q.where('key', 'sex')).fetchCount();
}

describe('SX1: loadSex reads the stored setting', () => {
  it('gives null when there is no row', async () => {
    const db = makeDb();
    expect(await loadSex(db)).toBeNull();
  });

  const cases: Array<[string, string | null]> = [
    ['male', 'male'],
    ['female', 'female'],
    ['Male', null],
    ['m', null],
    ['', null],
  ];
  cases.forEach(([stored, expected]) => {
    it(`reads the stored text of length ${stored.length} (${expected === null ? 'invalid' : 'valid'}) as ${String(expected)}`, async () => {
      const db = makeDb();
      await store(db, 'sex', stored);
      expect(await loadSex(db)).toBe(expected);
    });
  });

  it('reads a null stored value as null', async () => {
    const db = makeDb();
    await store(db, 'sex', null);
    expect(await loadSex(db)).toBeNull();
  });

  it('ignores a row under another key', async () => {
    const db = makeDb();
    await store(db, 'other', 'male');
    expect(await loadSex(db)).toBeNull();
  });
});

describe('SX5: saveSex and loadSex round trip', () => {
  it('reads back female, then null after saving null', async () => {
    const db = makeDb();
    await saveSex(db, 'female');
    expect(await loadSex(db)).toBe('female');
    await saveSex(db, null);
    expect(await loadSex(db)).toBeNull();
  });

  it('saving twice leaves exactly one row with the key "sex"', async () => {
    const db = makeDb();
    await saveSex(db, 'female');
    await saveSex(db, 'female');
    expect(await sexRowCount(db)).toBe(1);
    await saveSex(db, null);
    expect(await sexRowCount(db)).toBe(1);
  });

  it('male after female reads male', async () => {
    const db = makeDb();
    await saveSex(db, 'female');
    await saveSex(db, 'male');
    expect(await loadSex(db)).toBe('male');
    expect(await sexRowCount(db)).toBe(1);
  });

  it('updates the existing row that was stored directly, without creating a second one', async () => {
    const db = makeDb();
    await store(db, 'sex', 'Male');
    await saveSex(db, 'female');
    expect(await loadSex(db)).toBe('female');
    expect(await sexRowCount(db)).toBe(1);
  });
});
