import { nowDateTime } from '../utils/datetime.js';

/**
 * @file 工资记录仓储。
 *
 * 金额列以整数分存储并返回。四个派生
 * 列（`gross_pay`、`total_deduction`、`pre_tax_salary`、`after_tax_salary`）
 * 可为 null：null 值表示“按需根据组成项重新计算”。
 */

/** 不可为 null 的金额组成列（DB snake_case -> 实体 camelCase）。 */
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

/** 可为 null 的派生金额列。 */
const DERIVED_COLUMNS = Object.freeze({
  gross_pay: 'grossPay',
  total_deduction: 'totalDeduction',
  pre_tax_salary: 'preTaxSalary',
  after_tax_salary: 'afterTaxSalary',
});

/**
 * 将数据库行映射为工资实体（金额字段以分为单位）。
 *
 * @param {object | undefined} row - 数据库行。
 * @returns {object | null} 实体或 null。
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
 * 为插入/更新构建完整的列参数映射。
 *
 * @param {object} entity - 工资实体（金额以分为单位）。
 * @returns {object} 列 -> 值的参数对象。
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
 * `salary_records` 表的仓储。
 */
export class SalaryRecordRepository {
  /**
   * @param {object} db - 数据库句柄。
   */
  constructor(db) {
    /** @type {object} */
    this.db = db;
  }

  /**
   * 列出用户的所有记录，按年份再按月份升序排序。
   *
   * @param {number} userId - 所有者 id。
   * @returns {object[]} 实体。
   */
  findByUser(userId) {
    return this.db
      .prepare('SELECT * FROM salary_records WHERE user_id = ? ORDER BY year ASC, month ASC')
      .all(userId)
      .map(mapSalary);
  }

  /**
   * 列出用户单个年份的记录。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} year - 年份。
   * @returns {object[]} 按月份升序排序的实体。
   */
  findByUserAndYear(userId, year) {
    return this.db
      .prepare('SELECT * FROM salary_records WHERE user_id = ? AND year = ? ORDER BY month ASC')
      .all(userId, year)
      .map(mapSalary);
  }

  /**
   * 列出用户两个年份之间的记录（含边界）。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} startYear - 起始年份（含）。
   * @param {number} endYear - 结束年份（含）。
   * @returns {object[]} 按年份再按月份升序排序的实体。
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
   * 查找归属指定所有者的单条记录。
   *
   * @param {number} id - 记录 id。
   * @param {number} userId - 所有者 id。
   * @returns {object | null} 实体或 null。
   */
  findByIdAndUser(id, userId) {
    return mapSalary(
      this.db.prepare('SELECT * FROM salary_records WHERE id = ? AND user_id = ?').get(id, userId)
    );
  }

  /**
   * 按自然键（user、year、month）查找记录。
   *
   * @param {number} userId - 所有者 id。
   * @param {number} year - 年份。
   * @param {number} month - 月份（0 = 年终奖）。
   * @returns {object | null} 实体或 null。
   */
  findByUserYearMonth(userId, year, month) {
    return mapSalary(
      this.db
        .prepare('SELECT * FROM salary_records WHERE user_id = ? AND year = ? AND month = ?')
        .get(userId, year, month)
    );
  }

  /**
   * 插入新的工资记录。
   *
   * @param {object} entity - 工资实体（金额以分为单位）。
   * @returns {object} 已插入的实体。
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
   * 更新现有工资记录。
   *
   * @param {number} id - 记录 id。
   * @param {number} userId - 所有者 id。
   * @param {object} entity - 工资实体（金额以分为单位）。
   * @returns {object | null} 已更新的实体。
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
   * 删除归属指定所有者的记录。
   *
   * @param {number} id - 记录 id。
   * @param {number} userId - 所有者 id。
   * @returns {boolean} 删除了一行时为 true。
   */
  deleteByIdAndUser(id, userId) {
    return (
      this.db.prepare('DELETE FROM salary_records WHERE id = ? AND user_id = ?').run(id, userId)
        .changes > 0
    );
  }
}

export default SalaryRecordRepository;
