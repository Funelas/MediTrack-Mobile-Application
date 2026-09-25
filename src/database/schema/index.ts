import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 4,
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
        {name: 'intake_times', type: 'string'},       // JSON array e.g. ["08:00","20:00"]
        {name: 'start_date', type: 'number'},
        {name: 'rrule', type: 'string'},               // e.g. "FREQ=DAILY" | "FREQ=WEEKLY;BYDAY=MO,WE"
        {name: 'ends_type', type: 'string'},           // "never" | "on_date" | "after_occurrences"
        {name: 'end_date', type: 'number', isOptional: true},
        {name: 'occurrences_count', type: 'number', isOptional: true},
        {name: 'reminder_enabled', type: 'boolean'},
        {name: 'current_stock', type: 'number'},
        {name: 'max_stock', type: 'number'},
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
      name: 'tasks',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'type', type: 'string'},               // "reminder" | "appointment"
        {name: 'start_date', type: 'number'},          // timestamp of first occurrence date
        {name: 'time', type: 'string'},                // "HH:MM" 24h string
        {name: 'rrule', type: 'string'},               // e.g. "FREQ=DAILY;COUNT=1" for one-off
        {name: 'ends_type', type: 'string'},           // "never" | "on_date" | "after_occurrences"
        {name: 'end_date', type: 'number', isOptional: true},
        {name: 'occurrences_count', type: 'number', isOptional: true},
        {name: 'reminder', type: 'string'},            // "15min" etc.
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'doctor_clinic', type: 'string', isOptional: true},
        {name: 'location', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'occurrences',
      columns: [
        {name: 'reference_id', type: 'string', isIndexed: true},  // task or medicine id
        {name: 'reference_type', type: 'string'},                  // "task" | "med"
        {name: 'scheduled_date', type: 'number', isIndexed: true}, // midnight timestamp of the day
        {name: 'scheduled_time', type: 'string'},                  // "HH:MM" — which intake slot (meds can have multiple)
        {name: 'is_done', type: 'boolean'},
        {name: 'is_cancelled', type: 'boolean'},
        {name: 'snoozed_until', type: 'number', isOptional: true},
        {name: 'created_at', type: 'number'},
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
