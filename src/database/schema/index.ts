import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'medicines',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'generic_name', type: 'string', isOptional: true},
        {name: 'manufacturer', type: 'string', isOptional: true},
        {name: 'color', type: 'string'},
        {name: 'form', type: 'string'},
        {name: 'dosage', type: 'string'},
        {name: 'intake_time', type: 'number'},
        {name: 'times_per_day', type: 'number'},
        {name: 'repeat', type: 'string'},
        {name: 'reminder_enabled', type: 'boolean'},
        {name: 'current_stock', type: 'number'},
        {name: 'low_stock_alert', type: 'boolean'},
        {name: 'low_stock_threshold', type: 'number'},
        {name: 'tracking_method', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'intake_logs',
      columns: [
        {name: 'medicine_id', type: 'string', isIndexed: true},
        {name: 'taken_at', type: 'number'},
        {name: 'status', type: 'string'},
        {name: 'created_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'schedules',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'type', type: 'string'},
        {name: 'date', type: 'number'},
        {name: 'time', type: 'number'},
        {name: 'repeat', type: 'string'},
        {name: 'reminder', type: 'string'},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'doctor_clinic', type: 'string', isOptional: true},
        {name: 'location', type: 'string', isOptional: true},
        {name: 'is_done', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'checkup_reports',
      columns: [
        {name: 'category', type: 'string'},
        {name: 'checkup_date', type: 'number'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'test_results',
      columns: [
        {name: 'report_id', type: 'string', isIndexed: true},
        {name: 'test_name', type: 'string'},
        {name: 'unit', type: 'string'},
        {name: 'normal_range', type: 'string'},
        {name: 'value', type: 'string'},
        {name: 'status', type: 'string'},
        {name: 'created_at', type: 'number'},
      ],
    }),
  ],
});
