import {
  addColumns,
  createTable,
  schemaMigrations,
} from '@nozbe/watermelondb/Schema/migrations';

// Version 6 -> 7 (MOB-03 step 10): adds the engine result fields to test_results and checkup_reports, and the
// app_settings table. Every new column is optional, so rows saved before version 7 stay valid. The adapter must be
// given these migrations; without them, raising the schema version resets all user data.
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'test_results',
          columns: [
            {name: 'canonical_code', type: 'string', isOptional: true, isIndexed: true},
            {name: 'severity', type: 'string', isOptional: true},
            {name: 'direction', type: 'string', isOptional: true},
            {name: 'range_basis', type: 'string', isOptional: true},
            {name: 'result_type', type: 'string', isOptional: true},
            {name: 'value_std', type: 'number', isOptional: true},
            {name: 'ref_low', type: 'number', isOptional: true},
            {name: 'ref_high', type: 'number', isOptional: true},
            {name: 'ref_source', type: 'string', isOptional: true},
            {name: 'value_source', type: 'string', isOptional: true},
            {name: 'position', type: 'number', isOptional: true},
            {name: 'confidence', type: 'number', isOptional: true},
            {name: 'review_reasons', type: 'string', isOptional: true},
            {name: 'flag', type: 'string', isOptional: true},
          ],
        }),
        addColumns({
          table: 'checkup_reports',
          columns: [
            {name: 'contract_b', type: 'string', isOptional: true},
            {name: 'parser_version', type: 'string', isOptional: true},
            {name: 'dictionary_version', type: 'string', isOptional: true},
            {name: 'visit_day', type: 'string', isOptional: true, isIndexed: true},
          ],
        }),
        createTable({
          name: 'app_settings',
          columns: [
            {name: 'key', type: 'string', isIndexed: true},
            {name: 'value', type: 'string', isOptional: true},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
  ],
});
