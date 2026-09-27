import {Model} from '@nozbe/watermelondb';
import {field, date, nochange} from '@nozbe/watermelondb/decorators';

export default class Occurrence extends Model {
  static table = 'occurrences';

  @field('reference_id') referenceId!: string;
  @field('reference_type') referenceType!: string;
  @date('scheduled_date') scheduledDate!: Date;
  @field('scheduled_time') scheduledTime!: string;
  @field('is_done') isDone!: boolean;
  @field('is_cancelled') isCancelled!: boolean;
  @field('snoozed_until') snoozedUntil!: number;
  @field('time_override') timeOverride!: string;   // "HH:MM" or empty — replaces rule time
  @field('title_override') titleOverride!: string; // replaces task title for this occurrence
  @field('notes_override') notesOverride!: string; // replaces notes for this occurrence
  @nochange @date('created_at') createdAt!: Date;
}
