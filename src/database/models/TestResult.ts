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
  @field('status') status!: 'normal' | 'high' | 'low' | 'unknown';
  @readonly @date('created_at') createdAt!: Date;

  // Added in schema version 7; null on rows saved before it.
  @field('canonical_code') canonicalCode!: string | null;
  @field('severity') severity!: string | null;
  @field('direction') direction!: string | null;
  @field('range_basis') rangeBasis!: string | null;
  @field('result_type') resultType!: string | null;
  @field('value_std') valueStd!: number | null;
  @field('ref_low') refLow!: number | null;
  @field('ref_high') refHigh!: number | null;
  @field('ref_source') refSource!: string | null;
  @field('value_source') valueSource!: string | null;
  @field('position') position!: number | null;
  @field('confidence') confidence!: number | null;
  @field('review_reasons') reviewReasons!: string | null; // JSON array text
  @field('flag') flag!: string | null;

  @relation('checkup_reports', 'report_id') report!: CheckupReport;
}
