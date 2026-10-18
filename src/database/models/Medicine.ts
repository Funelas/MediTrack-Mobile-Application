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
  @field('intake_times') intakeTimes!: string;         // JSON array e.g. ["08:00","20:00"]
  @date('start_date') startDate!: Date;
  @field('rrule') rrule!: string;                      // e.g. "FREQ=DAILY" | "FREQ=WEEKLY;BYDAY=MO,WE"
  @field('ends_type') endsType!: string;               // "never" | "on_date" | "after_occurrences"
  @field('end_date') endDate!: number;
  @field('occurrences_count') occurrencesCount!: number;
  @field('reminder_enabled') reminderEnabled!: boolean;
  @field('current_stock') currentStock!: number;
  @field('max_stock') maxStock!: number;
  @field('low_stock_alert') lowStockAlert!: boolean;
  @field('low_stock_threshold') lowStockThreshold!: number;
  @field('tracking_method') trackingMethod!: string;
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('intake_logs') intakeLogs!: any;

  get parsedIntakeTimes(): string[] {
    try { return JSON.parse(this.intakeTimes); } catch { return []; }
  }

  // Returns a plain object with the rrule parts for easy consumption
  get parsedRrule(): {freq: string; byDay?: string[]; count?: number} {
    try {
      const parts: Record<string, string> = {};
      this.rrule.split(';').forEach(part => {
        const [k, v] = part.split('=');
        if (k && v) parts[k] = v;
      });
      return {
        freq: parts['FREQ'] ?? 'DAILY',
        byDay: parts['BYDAY'] ? parts['BYDAY'].split(',') : undefined,
        count: parts['COUNT'] ? parseInt(parts['COUNT']) : undefined,
      };
    } catch {
      return {freq: 'DAILY'};
    }
  }
}
