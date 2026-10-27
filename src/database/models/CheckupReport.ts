import {Model} from '@nozbe/watermelondb';
import {field, date, nochange, children} from '@nozbe/watermelondb/decorators';

export default class CheckupReport extends Model {
  static table = 'checkup_reports';
  static associations = {
    test_results: {type: 'has_many' as const, foreignKey: 'report_id'},
  };

  @field('category_id') categoryId!: string; // built-in id e.g. "clinical" or user category row id
  @date('checkup_date') checkupDate!: Date;
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Added in schema version 7; null on rows saved before it.
  @field('contract_b') contractB!: string | null; // JSON text
  @field('parser_version') parserVersion!: string | null;
  @field('dictionary_version') dictionaryVersion!: string | null;
  @field('visit_day') visitDay!: string | null; // "YYYY-MM-DD"

  @children('test_results') testResults!: any;
}
