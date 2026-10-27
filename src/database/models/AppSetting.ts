import {Model} from '@nozbe/watermelondb';
import {field, date} from '@nozbe/watermelondb/decorators';

export default class AppSetting extends Model {
  static table = 'app_settings';

  @field('key') key!: string;
  @field('value') value!: string | null;
  @date('updated_at') updatedAt!: Date;
}
