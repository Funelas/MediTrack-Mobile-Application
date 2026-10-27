// MOB-03 step 12: the "sex for lab ranges" setting (plan 6.5, D32), kept in the app_settings table under the key "sex".
// The sex is read only through loadSex. It is never read from a scan, never put in a contract or a saved row, and changing
// it does not re-score saved reports.
import {Database, Q} from '@nozbe/watermelondb';
import AppSetting from './models/AppSetting';

export type Sex = 'male' | 'female';

const SEX_KEY = 'sex';

/** The stored sex: exactly "male" or "female"; any other value, or no row, gives null. */
export async function loadSex(db: Database): Promise<Sex | null> {
  const rows = await db.get<AppSetting>('app_settings').query(Q.where('key', SEX_KEY)).fetch();
  if (rows.length === 0) {
    return null;
  }
  const value = rows[0].value;
  return value === 'male' || value === 'female' ? value : null;
}

/** Writes the sex (null for unset) in one `db.write`: updates the row with the key "sex" if there is one, else creates it. */
export async function saveSex(db: Database, sex: Sex | null): Promise<void> {
  const settings = db.get<AppSetting>('app_settings');
  await db.write(async () => {
    const existing = await settings.query(Q.where('key', SEX_KEY)).fetch();
    const now = new Date();
    if (existing.length > 0) {
      await existing[0].update(row => {
        row.value = sex;
        row.updatedAt = now;
      });
    } else {
      await settings.create(row => {
        row.key = SEX_KEY;
        row.value = sex;
        row.updatedAt = now;
      });
    }
  });
}
