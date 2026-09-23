import {Model} from '@nozbe/watermelondb';
import {field, date, readonly, children} from '@nozbe/watermelondb/decorators';

export default class CheckupReport extends Model {
  static table = 'checkup_reports';
  static associations = {
    test_results: {type: 'has_many' as const, foreignKey: 'report_id'},
  };

  @field('category') category!: string;
  @date('checkup_date') checkupDate!: Date;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('test_results') testResults!: any;
}
