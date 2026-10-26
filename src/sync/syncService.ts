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

export async function syncDatabase(userId: string): Promise<void> {
  await synchronize({
    database,

    pullChanges: async ({lastPulledAt}) => {
      const timestamp = lastPulledAt ?? 0;
      const changes: Record<string, {created: any[]; updated: any[]; deleted: string[]}> = {};

      for (const table of TABLES) {
        // Fetch created/updated rows
        const {data: upserted, error: upsertErr} = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .eq('deleted', false)
          .gt('last_modified', timestamp);

        if (upsertErr) throw new Error(`Pull error on ${table}: ${upsertErr.message}`);

        // Fetch deleted rows
        const {data: deleted, error: deleteErr} = await supabase
          .from(table)
          .select('id')
          .eq('user_id', userId)
          .eq('deleted', true)
          .gt('last_modified', timestamp);

        if (deleteErr) throw new Error(`Pull delete error on ${table}: ${deleteErr.message}`);

        changes[table] = {
          created: upserted ?? [],
          updated: [],
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

        // Upsert created + updated rows — add user_id to each
        const toUpsert = [...created, ...updated].map(row => ({
          ...row,
          user_id: userId,
          last_modified: Date.now(),
          deleted: false,
        }));

        if (toUpsert.length > 0) {
          const {error} = await supabase.from(table).upsert(toUpsert);
          if (error) throw new Error(`Push upsert error on ${table}: ${error.message}`);
        }

        // Soft-delete rows
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

    migrationsEnabledAtVersion: 1,
  });
}
