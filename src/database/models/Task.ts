import {Model} from '@nozbe/watermelondb';
import {field, date, nochange} from '@nozbe/watermelondb/decorators';

export default class Task extends Model {
  static table = 'tasks';

  @field('title') title!: string;
  @field('type') type!: string;             // "reminder" | "appointment"
  @date('start_date') startDate!: Date;
  @field('time') time!: string;             // "HH:MM" 24h string
  @field('rrule') rrule!: string;           // e.g. "FREQ=DAILY;COUNT=1"
  @field('ends_type') endsType!: string;    // "never" | "on_date" | "after_occurrences"
  @field('end_date') endDate!: number;
  @field('occurrences_count') occurrencesCount!: number;
  @field('reminder') reminder!: string;
  @field('notes') notes!: string;
  @field('doctor_clinic') doctorClinic!: string;
  @field('location') location!: string;
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
