import {Model} from '@nozbe/watermelondb';
import {field, date, nochange} from '@nozbe/watermelondb/decorators';

export default class Occurrence extends Model {
  static table = 'occurrences';

  @field('reference_id') referenceId!: string;       // task or medicine id
  @field('reference_type') referenceType!: string;   // "task" | "med"
  @date('scheduled_date') scheduledDate!: Date;       // midnight of the day this occurrence belongs to
  @field('scheduled_time') scheduledTime!: string;   // "HH:MM" — which time slot (needed for multi-dose meds)
  @field('is_done') isDone!: boolean;
  @field('is_cancelled') isCancelled!: boolean;
  @field('snoozed_until') snoozedUntil!: number;     // timestamp, 0 if not snoozed
  @nochange @date('created_at') createdAt!: Date;
}
