import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, relation} from '@nozbe/watermelondb/decorators';
import Medicine from './Medicine';

export default class IntakeLog extends Model {
  static table = 'intake_logs';
  static associations = {
    medicines: {type: 'belongs_to' as const, key: 'medicine_id'},
  };

  @field('medicine_id') medicineId!: string;
  @date('taken_at') takenAt!: Date;
  @field('status') status!: 'taken' | 'skipped' | 'snoozed';
  @readonly @date('created_at') createdAt!: Date;

  @relation('medicines', 'medicine_id') medicine!: Medicine;
}
