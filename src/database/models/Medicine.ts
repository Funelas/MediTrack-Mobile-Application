import {Model} from '@nozbe/watermelondb';
import {field, date, nochange, children} from '@nozbe/watermelondb/decorators';

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
  @field('intake_times') intakeTimes!: string;       // JSON array e.g. ["08:00","20:00"]
  @date('start_date') startDate!: Date;
  @field('repeat') repeat!: string;                  // JSON e.g. {"type":"everyday"} or {"type":"custom","days":["Mon","Wed"]}
  @field('ends_type') endsType!: string;             // "never" | "on_date" | "after_occurrences"
  @field('end_date') endDate!: number;
  @field('occurrences') occurrences!: number;
  @field('reminder_enabled') reminderEnabled!: boolean;
  @field('current_stock') currentStock!: number;
  @field('max_stock') maxStock!: number;
  @field('low_stock_alert') lowStockAlert!: boolean;
  @field('low_stock_threshold') lowStockThreshold!: number;
  @field('tracking_method') trackingMethod!: string;
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('intake_logs') intakeLogs!: any;

  // Helpers
  get parsedIntakeTimes(): string[] {
    try { return JSON.parse(this.intakeTimes); } catch { return []; }
  }

  get parsedRepeat(): {type: 'everyday' | 'custom'; days?: string[]} {
    try { return JSON.parse(this.repeat); } catch { return {type: 'everyday'}; }
  }
}
