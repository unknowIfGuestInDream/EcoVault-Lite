/**
 * @file 工资派生字段计算。
 *
 * 工资记录的派生字段计算逻辑。所有值均以整数分表示。
 * 每个派生字段在存在存储的覆盖值时返回该值
 * （非 null），否则根据组成字段即时计算。
 */

/** 标记年终奖记录的月份值。 */
export const ANNUAL_BONUS_MONTH = 0;

/**
 * 判断记录是否表示年终奖（month === 0）。
 *
 * @param {{ month: number }} record - 工资记录。
 * @returns {boolean} 记录为年终奖时返回 true。
 */
export function isAnnualBonus(record) {
  return record.month === ANNUAL_BONUS_MONTH;
}

/**
 * 计算应发工资（所有收入组成部分之和），单位为分。
 *
 * @param {object} r - 工资记录（金额以分表示）。
 * @returns {number} 以分表示的应发工资。
 */
export function grossPay(r) {
  if (r.grossPay !== null && r.grossPay !== undefined) {
    return r.grossPay;
  }
  return (
    (r.baseSalary ?? 0) +
    (r.performanceSalary ?? 0) +
    (r.housingAllowance ?? 0) +
    (r.mealAllowance ?? 0) +
    (r.transportAllowance ?? 0) +
    (r.overtimePay ?? 0) +
    (r.overtimeAllowance ?? 0) +
    (r.bonus ?? 0)
  );
}

/**
 * 计算法定扣款总额，单位为分。
 *
 * @param {object} r - 工资记录（金额以分表示）。
 * @returns {number} 以分表示的扣款总额。
 */
export function totalDeduction(r) {
  if (r.totalDeduction !== null && r.totalDeduction !== undefined) {
    return r.totalDeduction;
  }
  return (
    (r.medicalDeduction ?? 0) +
    (r.pensionDeduction ?? 0) +
    (r.unemploymentDeduction ?? 0) +
    (r.housingFundDeduction ?? 0)
  );
}

/**
 * 计算税前工资（应发 - 扣款总额），单位为分。
 *
 * @param {object} r - 工资记录（金额以分表示）。
 * @returns {number} 以分表示的税前工资。
 */
export function preTaxSalary(r) {
  if (r.preTaxSalary !== null && r.preTaxSalary !== undefined) {
    return r.preTaxSalary;
  }
  return grossPay(r) - totalDeduction(r);
}

/**
 * 计算税后工资（税前 - 个税），单位为分。
 *
 * @param {object} r - 工资记录（金额以分表示）。
 * @returns {number} 以分表示的税后工资。
 */
export function afterTaxSalary(r) {
  if (r.afterTaxSalary !== null && r.afterTaxSalary !== undefined) {
    return r.afterTaxSalary;
  }
  return preTaxSalary(r) - (r.incomeTax ?? 0);
}

/**
 * 实发工资（null 安全），单位为分。
 *
 * @param {object} r - 工资记录（金额以分表示）。
 * @returns {number} 以分表示的实发工资。
 */
export function netPay(r) {
  return r.netPay ?? 0;
}

export default {
  ANNUAL_BONUS_MONTH,
  isAnnualBonus,
  grossPay,
  totalDeduction,
  preTaxSalary,
  afterTaxSalary,
  netPay,
};
