import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, children} from '@nozbe/watermelondb/decorators';

export default class Medicine extends Model {
  static table = 'medicines';
  static associations = {
    intake_logs: {type: 'has_many' as const, foreignKey: 'medicine_id'},
  };

  @field('name') name!: string;
  @field('generic_name') genericName!: string;
  @field('manufacturer') manufacturer!: string;
  @field('color') color!: string;
  @field('form') form!: string;
  @field('dosage') dosage!: string;
  @date('intake_time') intakeTime!: Date;
  @field('times_per_day') timesPerDay!: number;
  @field('repeat') repeat!: string;
  @field('reminder_enabled') reminderEnabled!: boolean;
  @field('current_stock') currentStock!: number;
  @field('low_stock_alert') lowStockAlert!: boolean;
  @field('low_stock_threshold') lowStockThreshold!: number;
  @field('tracking_method') trackingMethod!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('intake_logs') intakeLogs!: any;
}
