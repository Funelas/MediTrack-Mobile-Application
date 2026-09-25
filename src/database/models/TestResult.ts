import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, relation} from '@nozbe/watermelondb/decorators';
import CheckupReport from './CheckupReport';

export default class TestResult extends Model {
  static table = 'test_results';
  static associations = {
    checkup_reports: {type: 'belongs_to' as const, key: 'report_id'},
  };

  @field('report_id') reportId!: string;
  @field('test_name') testName!: string;
  @field('unit') unit!: string;
  @field('normal_range') normalRange!: string;
  @field('value') value!: string;
  @field('status') status!: 'normal' | 'high' | 'low';
  @readonly @date('created_at') createdAt!: Date;

  @relation('checkup_reports', 'report_id') report!: CheckupReport;
}
