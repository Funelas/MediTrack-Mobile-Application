import {synchronize} from '@nozbe/watermelondb/sync';
import {database} from '../database';
import {supabase} from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import {Q} from '@nozbe/watermelondb';

const TABLES = [
  'medicines',
  'intake_logs',
  'tasks',
  'occurrences',
  'checkup_reports',
  'test_results',
  'categories',
];

let isSyncing = false;

export async function syncDatabase(userId: string): Promise<void> {
  if (isSyncing) { console.log('[Sync] Already syncing, skipping'); return; }
  isSyncing = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('[Sync] Offline, skipping');
      return;
    }

    console.log('[Sync] Starting sync for user:', userId);

    await synchronize({
      database,

      pullChanges: async ({lastPulledAt}) => {
        const timestamp = lastPulledAt ?? 0;
        console.log('[Sync] Pulling changes since:', timestamp);
        const changes: Record<string, {created: any[]; updated: any[]; deleted: string[]}> = {};

        for (const table of TABLES) {
          const {data: upserted, error: upsertErr} = await supabase
            .from(table)
            .select('*')
            .eq('user_id', userId)
            .eq('deleted', false)
            .gt('last_modified', timestamp);

          if (upsertErr) throw new Error(`Pull error on ${table}: ${upsertErr.message}`);

          const {data: deleted, error: deleteErr} = await supabase
            .from(table)
            .select('id')
            .eq('user_id', userId)
            .eq('deleted', true)
            .gt('last_modified', timestamp);

          if (deleteErr) throw new Error(`Pull delete error on ${table}: ${deleteErr.message}`);

          const clean = (rows: any[]) =>
            rows.map(({user_id, last_modified, deleted: _d, _status, _changed, ...rest}) => rest);

          const cleanedUpserted = clean(upserted ?? []);
          const cleanedDeleted = (deleted ?? []).map(r => r.id);

          if (cleanedUpserted.length > 0 || cleanedDeleted.length > 0) {
            console.log(`[Sync] Pull ${table}: ${cleanedUpserted.length} updated, ${cleanedDeleted.length} deleted`);
          }

          changes[table] = {
            created: [],
            updated: cleanedUpserted,
            deleted: cleanedDeleted,
          };
        }

        return {changes, timestamp: Date.now()};
      },

      pushChanges: async ({changes}) => {
        console.log('[Sync] Pushing local changes...');

        for (const table of TABLES) {
          const tableChanges = changes[table];
          if (!tableChanges) continue;

          const {created, updated, deleted} = tableChanges;
          const total = created.length + updated.length + deleted.length;

          if (total > 0) {
            console.log(`[Sync] Push ${table}: ${created.length} created, ${updated.length} updated, ${deleted.length} deleted`);
          }

          const toUpsert = [...created, ...updated].map(
            ({_status, _changed, ...row}) => ({
              ...row,
              user_id: userId,
              last_modified: Date.now(),
              deleted: false,
            })
          );

          if (toUpsert.length > 0) {
            console.log(`[Sync] Upserting ${toUpsert.length} rows to ${table}:`, JSON.stringify(toUpsert[0]));
            const {error} = await supabase.from(table).upsert(toUpsert);
            if (error) throw new Error(`Push upsert error on ${table}: ${error.message}`);
            console.log(`[Sync] Upsert ${table} success`);
          }

          if (deleted.length > 0) {
            const {error} = await supabase
              .from(table)
              .update({deleted: true, last_modified: Date.now()})
              .in('id', deleted)
              .eq('user_id', userId);
            if (error) throw new Error(`Push delete error on ${table}: ${error.message}`);
          }
        }

        console.log('[Sync] Push complete');
      },

      migrationsEnabledAtVersion: 7,
    });

    console.log('[Sync] Sync finished successfully');
  } catch (e: any) {
    console.log('[Sync] Sync error:', e.message);
    throw e;
  } finally {
    isSyncing = false;
  }
}

/**
 * Force-pushes ALL local records to Supabase regardless of sync status.
 * Used by the "Sync Now" button to ensure everything is uploaded.
 */
export async function pushAllToRemote(userId: string): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected || !netState.isInternetReachable) {
    throw new Error('No internet connection.');
  }

  console.log('[PushAll] Starting full push for user:', userId);

  for (const table of TABLES) {
    // Fetch all non-deleted local records
    const collection = database.get(table);
    const records = await collection.query(
      Q.where('id', Q.notEq(''))
    ).fetch();

    if (records.length === 0) {
      console.log(`[PushAll] ${table}: no records`);
      continue;
    }

    // Serialize each record's raw data
    const rows = records.map((record: any) => {
      const raw = {...record._raw};
      // Remove WatermelonDB internal fields
      delete raw._status;
      delete raw._changed;
      return {
        ...raw,
        user_id: userId,
        last_modified: Date.now(),
        deleted: false,
      };
    });

    console.log(`[PushAll] ${table}: pushing ${rows.length} records`);

    const {error} = await supabase.from(table).upsert(rows);
    if (error) throw new Error(`Push error on ${table}: ${error.message}`);

    console.log(`[PushAll] ${table}: success`);
  }

  console.log('[PushAll] All tables pushed successfully');
}
