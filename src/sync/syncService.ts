import {synchronize} from '@nozbe/watermelondb/sync';
import {database} from '../database';
import {supabase} from '../lib/supabase';

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
  if (isSyncing) return;
  isSyncing = true;
  try {
    await synchronize({
    database,

    pullChanges: async ({lastPulledAt}) => {
      const timestamp = lastPulledAt ?? 0;
      const changes: Record<string, {created: any[]; updated: any[]; deleted: string[]}> = {};

      for (const table of TABLES) {
        // Fetch created/updated rows since last pull
        const {data: upserted, error: upsertErr} = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .eq('deleted', false)
          .gt('last_modified', timestamp);

        if (upsertErr) throw new Error(`Pull error on ${table}: ${upsertErr.message}`);

        // Fetch deleted rows since last pull
        const {data: deleted, error: deleteErr} = await supabase
          .from(table)
          .select('id')
          .eq('user_id', userId)
          .eq('deleted', true)
          .gt('last_modified', timestamp);

        if (deleteErr) throw new Error(`Pull delete error on ${table}: ${deleteErr.message}`);

        // Strip internal WatermelonDB and Supabase-only fields before handing to WDB
        const clean = (rows: any[]) =>
          rows.map(({user_id, last_modified, deleted: _d, _status, _changed, ...rest}) => rest);

        changes[table] = {
          created: [],
          updated: clean(upserted ?? []),
          deleted: (deleted ?? []).map(r => r.id),
        };
      }

      return {changes, timestamp: Date.now()};
    },

    pushChanges: async ({changes}) => {
      for (const table of TABLES) {
        const tableChanges = changes[table];
        if (!tableChanges) continue;

        const {created, updated, deleted} = tableChanges;

        // Upsert created + updated — strip WatermelonDB internal fields, add user_id
        const toUpsert = [...created, ...updated].map(
          ({_status, _changed, ...row}) => ({
            ...row,
            user_id: userId,
            last_modified: Date.now(),
            deleted: false,
          })
        );

        if (toUpsert.length > 0) {
          const {error} = await supabase.from(table).upsert(toUpsert);
          if (error) throw new Error(`Push upsert error on ${table}: ${error.message}`);
        }

        // Soft-delete
        if (deleted.length > 0) {
          const {error} = await supabase
            .from(table)
            .update({deleted: true, last_modified: Date.now()})
            .in('id', deleted)
            .eq('user_id', userId);
          if (error) throw new Error(`Push delete error on ${table}: ${error.message}`);
        }
      }
    },

   migrationsEnabledAtVersion: 7,
    });
  } finally {
    isSyncing = false;
  }
}
