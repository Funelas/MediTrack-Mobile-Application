import {Model} from '@nozbe/watermelondb';
import {field, date, nochange} from '@nozbe/watermelondb/decorators';
import {CategoryField} from '../../data/categoryDefinitions';

export default class Category extends Model {
  static table = 'categories';

  @field('label') label!: string;
  @field('icon') icon!: string;    // CategoryIconKey
  @field('color') color!: string;
  @field('fields') fields!: string; // JSON-encoded CategoryField[]
  @nochange @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  get parsedFields(): CategoryField[] {
    try { return JSON.parse(this.fields); } catch { return []; }
  }
}
