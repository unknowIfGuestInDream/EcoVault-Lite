/**
 * @file Salary derived-field calculations.
 *
 * Mirrors the getter logic on the Java `SalaryRecord` entity. All values are in
 * integer cents. Each derived field returns its stored override when present
 * (non-null), otherwise it is computed on the fly from the component fields.
 */

/** Month value that marks an annual-bonus record. */
export const ANNUAL_BONUS_MONTH = 0;

/**
 * Whether a record represents the annual bonus (month === 0).
 *
 * @param {{ month: number }} record - Salary record.
 * @returns {boolean} True when the record is the annual bonus.
 */
export function isAnnualBonus(record) {
  return record.month === ANNUAL_BONUS_MONTH;
}

/**
 * Compute gross pay (sum of all earning components) in cents.
 *
 * @param {object} r - Salary record (money in cents).
 * @returns {number} Gross pay in cents.
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
 * Compute the total statutory deduction in cents.
 *
 * @param {object} r - Salary record (money in cents).
 * @returns {number} Total deduction in cents.
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
 * Compute pre-tax salary (gross - total deduction) in cents.
 *
 * @param {object} r - Salary record (money in cents).
 * @returns {number} Pre-tax salary in cents.
 */
export function preTaxSalary(r) {
  if (r.preTaxSalary !== null && r.preTaxSalary !== undefined) {
    return r.preTaxSalary;
  }
  return grossPay(r) - totalDeduction(r);
}

/**
 * Compute after-tax salary (pre-tax - income tax) in cents.
 *
 * @param {object} r - Salary record (money in cents).
 * @returns {number} After-tax salary in cents.
 */
export function afterTaxSalary(r) {
  if (r.afterTaxSalary !== null && r.afterTaxSalary !== undefined) {
    return r.afterTaxSalary;
  }
  return preTaxSalary(r) - (r.incomeTax ?? 0);
}

/**
 * Net pay (null-safe) in cents.
 *
 * @param {object} r - Salary record (money in cents).
 * @returns {number} Net pay in cents.
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
