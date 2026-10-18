import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, nochange} from '@nozbe/watermelondb/decorators';

export default class Schedule extends Model {
  static table = 'schedules';

  @field('title') title!: string;
  @field('type') type!: string;
  @date('date') date!: Date;
  @date('time') time!: Date;
  @field('repeat') repeat!: string;
  @field('reminder') reminder!: string;
  @field('notes') notes!: string;
  @field('doctor_clinic') doctorClinic!: string;
  @field('location') location!: string;
  @field('is_done') isDone!: boolean;
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
