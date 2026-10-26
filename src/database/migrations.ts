import {addColumns, createTable, schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 7,
      steps: [
        // WatermelonDB sync needs _status and _changed on every synced table
        // These are added automatically by WatermelonDB when sync is enabled
        // No manual column additions needed — WatermelonDB handles this internally
      ],
    },
  ],
});
