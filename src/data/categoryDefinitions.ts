/**
 * Single source of truth for built-in checkup category definitions.
 * Each field carries its reference range so status can be computed at save time.
 *
 * normalRange format:
 *   ">40"       — greater than 40
 *   "<100"      — less than 100
 *   "4.0-5.6"   — inclusive range
 *   ""          — no reference range (descriptive fields)
 */

export type FieldType = 'numerical' | 'descriptive';
export type ResultStatus = 'normal' | 'high' | 'low' | 'unknown';

export interface CategoryField {
  name: string;
  unit: string;
  normalRange: string;   // stored as string e.g. "4.0-5.6", ">40", "<100"
  required?: boolean;
  type: FieldType;
}

export interface BuiltInCategory {
  id: string;
  label: string;
  icon: string;           // CategoryIconKey
  isBuiltIn: true;
  fields: CategoryField[];
}

// ─── Status computation ───────────────────────────────────────────────────────

/**
 * Given a numeric value and a normalRange string, return the status.
 * Returns 'unknown' when the range can't be parsed or value is empty.
 */
export function computeStatus(value: string, normalRange: string): ResultStatus {
  const num = parseFloat(value);
  if (isNaN(num) || !normalRange) return 'unknown';

  // ">X" — value must be greater than X
  const gtMatch = normalRange.match(/^>(\d+\.?\d*)$/);
  if (gtMatch) {
    return num >= parseFloat(gtMatch[1]) ? 'normal' : 'low';
  }

  // ">=X"
  const gteMatch = normalRange.match(/^>=(\d+\.?\d*)$/);
  if (gteMatch) {
    return num >= parseFloat(gteMatch[1]) ? 'normal' : 'low';
  }

  // "<X" — value must be less than X
  const ltMatch = normalRange.match(/^<(\d+\.?\d*)$/);
  if (ltMatch) {
    return num <= parseFloat(ltMatch[1]) ? 'normal' : 'high';
  }

  // "<=X"
  const lteMatch = normalRange.match(/^<=(\d+\.?\d*)$/);
  if (lteMatch) {
    return num <= parseFloat(lteMatch[1]) ? 'normal' : 'high';
  }

  // "X-Y" or "X - Y" — inclusive range
  const rangeMatch = normalRange.match(/^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (num < lo) return 'low';
    if (num > hi) return 'high';
    return 'normal';
  }

  return 'unknown';
}

// ─── Built-in categories ──────────────────────────────────────────────────────

export const BUILT_IN_CATEGORIES: BuiltInCategory[] = [
  {
    id: 'clinical',
    label: 'Clinical Chemistry',
    icon: 'flask',
    isBuiltIn: true,
    fields: [
      {name: 'HbA1C',             unit: '%',      normalRange: '4.0-5.6',   required: true,  type: 'numerical'},
      {name: 'FBS',               unit: 'mg/dL',  normalRange: '70-100',    required: true,  type: 'numerical'},
      {name: 'Total Cholesterol',  unit: 'mg/dL',  normalRange: '<200',                       type: 'numerical'},
      {name: 'HDL',               unit: 'mg/dL',  normalRange: '>40',                        type: 'numerical'},
      {name: 'LDL',               unit: 'mg/dL',  normalRange: '<100',                       type: 'numerical'},
      {name: 'VLDL',              unit: 'mg/dL',  normalRange: '2-30',                       type: 'numerical'},
      {name: 'Triglycerides',     unit: 'mg/dL',  normalRange: '<150',                       type: 'numerical'},
      {name: 'BUN',               unit: 'mg/dL',  normalRange: '7-20',                       type: 'numerical'},
      {name: 'BUA',               unit: 'mg/dL',  normalRange: '2.4-7.0',                    type: 'numerical'},
      {name: 'Creatinine',        unit: 'mg/dL',  normalRange: '0.6-1.2',                    type: 'numerical'},
      {name: 'SGPT (ALT)',        unit: 'U/L',    normalRange: '7-56',                       type: 'numerical'},
      {name: 'SGOT (AST)',        unit: 'U/L',    normalRange: '10-40',                      type: 'numerical'},
      {name: 'Magnesium',         unit: 'mg/dL',  normalRange: '1.7-2.2',                    type: 'numerical'},
      {name: 'Sodium',            unit: 'mEq/L',  normalRange: '136-145',                    type: 'numerical'},
      {name: 'Potassium',         unit: 'mEq/L',  normalRange: '3.5-5.0',                    type: 'numerical'},
      {name: 'Ionized Calcium',   unit: 'mEq/L',  normalRange: '4.5-5.3',                    type: 'numerical'},
    ],
  },
  {
    id: 'cbc',
    label: 'Complete Blood Count',
    icon: 'cell',
    isBuiltIn: true,
    fields: [
      {name: 'WBC',  unit: 'x10³/µL', normalRange: '4.5-11.0',  required: true, type: 'numerical'},
      {name: 'RBC',  unit: 'x10⁶/µL', normalRange: '4.5-5.5',   required: true, type: 'numerical'},
      {name: 'HGB',  unit: 'g/dL',    normalRange: '13.5-17.5',                  type: 'numerical'},
      {name: 'HCT',  unit: '%',       normalRange: '41-53',                       type: 'numerical'},
      {name: 'MCV',  unit: 'fL',      normalRange: '80-100',                      type: 'numerical'},
      {name: 'MCH',  unit: 'pg',      normalRange: '27-33',                       type: 'numerical'},
      {name: 'MCHC', unit: 'g/dL',   normalRange: '32-36',                       type: 'numerical'},
      {name: 'PLT',  unit: 'x10³/µL', normalRange: '150-400',                    type: 'numerical'},
    ],
  },
  {
    id: 'urinalysis',
    label: 'Urinalysis',
    icon: 'drop',
    isBuiltIn: true,
    fields: [
      {name: 'Color',    unit: '',      normalRange: '', type: 'descriptive'},
      {name: 'Clarity',  unit: '',      normalRange: '', type: 'descriptive'},
      {name: 'pH',       unit: '',      normalRange: '4.5-8.0', type: 'numerical'},
      {name: 'Protein',  unit: 'mg/dL', normalRange: '',  type: 'descriptive'},
      {name: 'Glucose',  unit: 'mg/dL', normalRange: '',  type: 'descriptive'},
      {name: 'WBC',      unit: '/hpf',  normalRange: '0-5', type: 'numerical'},
      {name: 'RBC',      unit: '/hpf',  normalRange: '0-2', type: 'numerical'},
    ],
  },
];

/** Look up a built-in category by id. Returns undefined for custom categories. */
export function getBuiltInCategory(id: string): BuiltInCategory | undefined {
  return BUILT_IN_CATEGORIES.find(c => c.id === id);
}

/** Get field definitions for any category id (built-in only). */
export function getFieldsForCategory(categoryId: string): CategoryField[] {
  return getBuiltInCategory(categoryId)?.fields ?? [];
}
