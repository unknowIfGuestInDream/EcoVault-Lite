import { nowDateTime } from '../utils/datetime.js';

/**
 * @file Salary record repository.
 *
 * Money columns are stored and returned as integer cents. The four derived
 * columns (`gross_pay`, `total_deduction`, `pre_tax_salary`, `after_tax_salary`)
 * are nullable: a null value means "recompute from components on demand".
 */

/** Non-nullable money component columns (DB snake_case -> entity camelCase). */
const MONEY_COLUMNS = Object.freeze({
  base_salary: 'baseSalary',
  performance_salary: 'performanceSalary',
  housing_allowance: 'housingAllowance',
  meal_allowance: 'mealAllowance',
  transport_allowance: 'transportAllowance',
  overtime_pay: 'overtimePay',
  overtime_allowance: 'overtimeAllowance',
  bonus: 'bonus',
  medical_base: 'medicalBase',
  pension_unemployment_base: 'pensionUnemploymentBase',
  housing_fund_base: 'housingFundBase',
  medical_deduction: 'medicalDeduction',
  pension_deduction: 'pensionDeduction',
  unemployment_deduction: 'unemploymentDeduction',
  housing_fund_deduction: 'housingFundDeduction',
  income_tax: 'incomeTax',
  serious_illness_medical: 'seriousIllnessMedical',
  heating_allowance: 'heatingAllowance',
  net_pay: 'netPay',
});

/** Nullable derived money columns. */
const DERIVED_COLUMNS = Object.freeze({
  gross_pay: 'grossPay',
  total_deduction: 'totalDeduction',
  pre_tax_salary: 'preTaxSalary',
  after_tax_salary: 'afterTaxSalary',
});

/**
 * Map a raw row to a salary entity (money fields as cents).
 *
 * @param {object | undefined} row - Raw row.
 * @returns {object | null} Entity or null.
 */
function mapSalary(row) {
  if (!row) {
    return null;
  }
  const entity = {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    month: row.month,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const [column, field] of Object.entries(MONEY_COLUMNS)) {
    entity[field] = row[column] ?? 0;
  }
  for (const [column, field] of Object.entries(DERIVED_COLUMNS)) {
    entity[field] = row[column] === null || row[column] === undefined ? null : row[column];
  }
  return entity;
}

/**
 * Build the full column parameter map for insert/update.
 *
 * @param {object} entity - Salary entity (money as cents).
 * @returns {object} Column -> value parameter object.
 */
function toParams(entity) {
  const params = {
    user_id: entity.userId,
    year: entity.year,
    month: entity.month,
    remark: entity.remark ?? null,
  };
  for (const [column, field] of Object.entries(MONEY_COLUMNS)) {
    params[column] = Math.round(entity[field] ?? 0);
  }
  for (const [column, field] of Object.entries(DERIVED_COLUMNS)) {
    const value = entity[field];
    params[column] = value === null || value === undefined ? null : Math.round(value);
  }
  return params;
}

const ALL_MONEY_COLUMNS = [...Object.keys(MONEY_COLUMNS), ...Object.keys(DERIVED_COLUMNS)];

/**
 * Repository for the `salary_records` table.
 */
export class SalaryRecordRepository {
  /**
   * @param {import('better-sqlite3').Database} db - Database handle.
   */
  constructor(db) {
    /** @type {import('better-sqlite3').Database} */
    this.db = db;
  }

  /**
   * List all of a user's records ordered by year then month ascending.
   *
   * @param {number} userId - Owner id.
   * @returns {object[]} Entities.
   */
  findByUser(userId) {
    return this.db
      .prepare('SELECT * FROM salary_records WHERE user_id = ? ORDER BY year ASC, month ASC')
      .all(userId)
      .map(mapSalary);
  }

  /**
   * List a user's records for a single year.
   *
   * @param {number} userId - Owner id.
   * @param {number} year - Year.
   * @returns {object[]} Entities ordered by month ascending.
   */
  findByUserAndYear(userId, year) {
    return this.db
      .prepare('SELECT * FROM salary_records WHERE user_id = ? AND year = ? ORDER BY month ASC')
      .all(userId, year)
      .map(mapSalary);
  }

  /**
   * List a user's records between two years (inclusive).
   *
   * @param {number} userId - Owner id.
   * @param {number} startYear - Start year (inclusive).
   * @param {number} endYear - End year (inclusive).
   * @returns {object[]} Entities ordered by year then month ascending.
   */
  findByUserAndYearBetween(userId, startYear, endYear) {
    return this.db
      .prepare(
        `SELECT * FROM salary_records WHERE user_id = ? AND year BETWEEN ? AND ?
         ORDER BY year ASC, month ASC`
      )
      .all(userId, startYear, endYear)
      .map(mapSalary);
  }

  /**
   * Find one record scoped to its owner.
   *
   * @param {number} id - Record id.
   * @param {number} userId - Owner id.
   * @returns {object | null} Entity or null.
   */
  findByIdAndUser(id, userId) {
    return mapSalary(
      this.db.prepare('SELECT * FROM salary_records WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * Find a record by its natural key (user, year, month).
   *
   * @param {number} userId - Owner id.
   * @param {number} year - Year.
   * @param {number} month - Month (0 = annual bonus).
   * @returns {object | null} Entity or null.
   */
  findByUserYearMonth(userId, year, month) {
    return mapSalary(
      this.db
        .prepare('SELECT * FROM salary_records WHERE user_id = ? AND year = ? AND month = ?')
        .get(userId, year, month)
    );
  }

  /**
   * Insert a new salary record.
   *
   * @param {object} entity - Salary entity (money as cents).
   * @returns {object} The inserted entity.
   */
  insert(entity) {
    const now = nowDateTime();
    const params = { ...toParams(entity), created_at: now, updated_at: now };
    const columns = [
      'user_id',
      'year',
      'month',
      ...ALL_MONEY_COLUMNS,
      'remark',
      'created_at',
      'updated_at',
    ];
    const placeholders = columns.map((c) => `@${c}`).join(', ');
    const info = this.db
      .prepare(`INSERT INTO salary_records (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(params);
    return this.findByIdAndUser(Number(info.lastInsertRowid), entity.userId);
  }

  /**
   * Update an existing salary record.
   *
   * @param {number} id - Record id.
   * @param {number} userId - Owner id.
   * @param {object} entity - Salary entity (money as cents).
   * @returns {object | null} Updated entity.
   */
  update(id, userId, entity) {
    const params = { ...toParams(entity), id, user_id: userId, updated_at: nowDateTime() };
    const assignments = [...ALL_MONEY_COLUMNS, 'year', 'month', 'remark', 'updated_at']
      .map((c) => `${c} = @${c}`)
      .join(', ');
    this.db
      .prepare(`UPDATE salary_records SET ${assignments} WHERE id = @id AND user_id = @user_id`)
      .run(params);
    return this.findByIdAndUser(id, userId);
  }

  /**
   * Delete a record scoped to its owner.
   *
   * @param {number} id - Record id.
   * @param {number} userId - Owner id.
   * @returns {boolean} True when a row was deleted.
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM salary_records WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default SalaryRecordRepository;
