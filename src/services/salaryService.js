import { BusinessError } from '../common/errors.js';
import * as salaryCalc from '../domain/salaryCalc.js';
import { fromCents, formatCents, sumCents, averageCents } from '../utils/money.js';

/**
 * @file Salary service.
 *
 * Reproduces the Java `SalaryServiceImpl`: upsert-by-(year,month), statistics
 * that separate the annual bonus from monthly records, 26-column CSV export
 * (with stored/derived columns) and a quote-aware CSV importer.
 */

/** The list of the eight earning component keys, in CSV/statistics order. */
const EARNING_KEYS = [
  'baseSalary',
  'performanceSalary',
  'housingAllowance',
  'mealAllowance',
  'transportAllowance',
  'overtimePay',
  'overtimeAllowance',
  'bonus',
];

/**
 * Parse a money cell (yuan string) into integer cents.
 *
 * @param {string | null | undefined} cell - Raw cell.
 * @returns {number} Cents (0 when blank).
 * @throws {BusinessError} When the value is not a valid number.
 */
function parseMoneyCell(cell) {
  if (cell === null || cell === undefined || String(cell).trim() === '') {
    return 0;
  }
  const trimmed = String(cell).trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    throw new BusinessError(`数值格式错误: "${trimmed}"，请确认 CSV 内容正确`);
  }
  return Math.round(Number(trimmed) * 100);
}

/**
 * Parse an integer cell.
 *
 * @param {string} cell - Raw cell.
 * @param {number} lineNum - 1-based line number (for error messages).
 * @param {string} colName - Column name (for error messages).
 * @returns {number} Parsed integer.
 * @throws {BusinessError} When the value is not an integer.
 */
function parseIntCell(cell, lineNum, colName) {
  const trimmed = String(cell).trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    throw new BusinessError(`第 ${lineNum} 行${colName}格式错误: ${cell}`);
  }
  return Number.parseInt(trimmed, 10);
}

/**
 * Escape a value for CSV output.
 *
 * @param {string | null | undefined} value - Raw value.
 * @returns {string} Escaped value.
 */
function escapeCsv(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const escaped = String(value).replace(/"/g, '""');
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Un-escape a quoted CSV cell.
 *
 * @param {string | null | undefined} cell - Raw cell.
 * @returns {string} Un-escaped value.
 */
function unescapeCsv(cell) {
  if (cell === null || cell === undefined) {
    return '';
  }
  let s = String(cell).trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

/**
 * Parse a single CSV line into fields honouring quotes and escaped quotes.
 *
 * @param {string} line - CSV line.
 * @returns {string[]} Parsed fields.
 */
function parseCsvLine(line) {
  const fields = [];
  let sb = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          sb += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        sb += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(sb);
      sb = '';
    } else {
      sb += c;
    }
  }
  fields.push(sb);
  return fields;
}

/**
 * Salary service.
 */
export class SalaryService {
  /**
   * @param {object} deps - Dependencies.
   * @param {object} deps.repository - Salary repo.
   */
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Insert or update a salary record for (userId, year, month).
   *
   * @param {number} userId - Owner id.
   * @param {object} request - Salary request.
   * @returns {object} Salary response.
   */
  save(userId, request) {
    const existing = this.repository.findByUserYearMonth(userId, request.year, request.month);
    const columns = this.#applyRequest(request);
    const record = existing
      ? this.repository.update(existing.id, userId, columns)
      : this.repository.insert({ userId, ...columns });
    return this.#toResponse(record);
  }

  /**
   * Update a salary record by id.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Record id.
   * @param {object} request - Salary request.
   * @returns {object} Salary response.
   * @throws {BusinessError} When the record does not exist.
   */
  update(userId, id, request) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('工资记录不存在');
    }
    const record = this.repository.update(id, userId, this.#applyRequest(request));
    return this.#toResponse(record);
  }

  /**
   * Delete a salary record by id.
   *
   * @param {number} userId - Owner id.
   * @param {number} id - Record id.
   * @returns {void}
   * @throws {BusinessError} When the record does not exist.
   */
  delete(userId, id) {
    const existing = this.repository.findByIdAndUser(id, userId);
    if (!existing) {
      throw new BusinessError('工资记录不存在');
    }
    this.repository.deleteByIdAndUser(id, userId);
  }

  /**
   * List salary records for a (optional) year range.
   *
   * @param {number} userId - Owner id.
   * @param {number} [startYear] - Optional start year.
   * @param {number} [endYear] - Optional end year.
   * @returns {object[]} Salary responses.
   */
  list(userId, startYear, endYear) {
    return this.#query(userId, startYear, endYear).map((record) => this.#toResponse(record));
  }

  /**
   * Compute salary statistics for a (optional) year range.
   *
   * @param {number} userId - Owner id.
   * @param {number} [startYear] - Optional start year.
   * @param {number} [endYear] - Optional end year.
   * @returns {object} Salary statistics.
   */
  statistics(userId, startYear, endYear) {
    const all = this.#query(userId, startYear, endYear);
    const monthly = [];
    let totalAnnualBonus = 0;
    for (const record of all) {
      if (salaryCalc.isAnnualBonus(record)) {
        totalAnnualBonus += salaryCalc.netPay(record);
      } else {
        monthly.push(record);
      }
    }

    const netValues = monthly.map((r) => salaryCalc.netPay(r));
    const totalNet = sumCents(netValues);
    const totalBonus = sumCents(monthly.map((r) => r.bonus ?? 0));
    const maxNet = monthly.length === 0 ? 0 : Math.max(...netValues);
    const minNet = monthly.length === 0 ? 0 : Math.min(...netValues);
    const averageNet = monthly.length === 0 ? 0 : averageCents(totalNet, monthly.length);

    const composition = {
      baseSalary: fromCents(sumCents(monthly.map((r) => r.baseSalary ?? 0))),
      performanceSalary: fromCents(sumCents(monthly.map((r) => r.performanceSalary ?? 0))),
      housingAllowance: fromCents(sumCents(monthly.map((r) => r.housingAllowance ?? 0))),
      mealAllowance: fromCents(sumCents(monthly.map((r) => r.mealAllowance ?? 0))),
      transportAllowance: fromCents(sumCents(monthly.map((r) => r.transportAllowance ?? 0))),
      overtimePay: fromCents(sumCents(monthly.map((r) => r.overtimePay ?? 0))),
      overtimeAllowance: fromCents(sumCents(monthly.map((r) => r.overtimeAllowance ?? 0))),
      bonus: fromCents(totalBonus),
    };
    const deductionComposition = {
      medical: fromCents(sumCents(monthly.map((r) => r.medicalDeduction ?? 0))),
      pension: fromCents(sumCents(monthly.map((r) => r.pensionDeduction ?? 0))),
      unemployment: fromCents(sumCents(monthly.map((r) => r.unemploymentDeduction ?? 0))),
      housingFund: fromCents(sumCents(monthly.map((r) => r.housingFundDeduction ?? 0))),
      incomeTax: fromCents(sumCents(monthly.map((r) => r.incomeTax ?? 0))),
    };
    const monthlyTrend = monthly.map((r) => ({
      label: `${String(r.year).padStart(4, '0')}-${String(r.month).padStart(2, '0')}`,
      net: fromCents(salaryCalc.netPay(r)),
      gross: fromCents(salaryCalc.grossPay(r)),
    }));

    return {
      totalNet: fromCents(totalNet),
      averageNet: fromCents(averageNet),
      maxNet: fromCents(maxNet),
      minNet: fromCents(minNet),
      totalBonus: fromCents(totalBonus),
      totalAnnualBonus: fromCents(totalAnnualBonus),
      monthlyTrend,
      composition,
      deductionComposition,
    };
  }

  /**
   * Export salary records as CSV plus a suggested filename.
   *
   * @param {number} userId - Owner id.
   * @param {number} [startYear] - Optional start year.
   * @param {number} [endYear] - Optional end year.
   * @returns {{ csv: string, filename: string }} CSV payload and filename.
   */
  exportCsv(userId, startYear, endYear) {
    const records = this.#query(userId, startYear, endYear);
    let sb = '\uFEFF';
    sb +=
      '年份,月份,基本工资,绩效工资,租房补助,伙食补助,交通补贴,加班费,加班补助,奖金,应发工资,' +
      '医疗保险缴费基数,养老失业缴费基数,公积金缴费基数,' +
      '医疗,养老,失业,公积金,扣除项合计,税前工资,所得税,税后工资,大病医疗,采暖补贴,实发金额,备注\n';
    for (const r of records) {
      const cells = [
        r.year,
        this.#monthLabel(r),
        formatCents(r.baseSalary ?? 0),
        formatCents(r.performanceSalary ?? 0),
        formatCents(r.housingAllowance ?? 0),
        formatCents(r.mealAllowance ?? 0),
        formatCents(r.transportAllowance ?? 0),
        formatCents(r.overtimePay ?? 0),
        formatCents(r.overtimeAllowance ?? 0),
        formatCents(r.bonus ?? 0),
        formatCents(salaryCalc.grossPay(r)),
        formatCents(r.medicalBase ?? 0),
        formatCents(r.pensionUnemploymentBase ?? 0),
        formatCents(r.housingFundBase ?? 0),
        formatCents(r.medicalDeduction ?? 0),
        formatCents(r.pensionDeduction ?? 0),
        formatCents(r.unemploymentDeduction ?? 0),
        formatCents(r.housingFundDeduction ?? 0),
        formatCents(salaryCalc.totalDeduction(r)),
        formatCents(salaryCalc.preTaxSalary(r)),
        formatCents(r.incomeTax ?? 0),
        formatCents(salaryCalc.afterTaxSalary(r)),
        formatCents(r.seriousIllnessMedical ?? 0),
        formatCents(r.heatingAllowance ?? 0),
        formatCents(salaryCalc.netPay(r)),
        escapeCsv(r.remark),
      ];
      sb += `${cells.join(',')}\n`;
    }
    return { csv: sb, filename: this.#buildExportFilename(startYear, endYear) };
  }

  /**
   * Import salary records from CSV content (upsert by year/month).
   *
   * @param {number} userId - Owner id.
   * @param {string} csvContent - CSV content.
   * @returns {number} Number of imported rows.
   * @throws {BusinessError} On empty/malformed content.
   */
  importCsv(userId, csvContent) {
    if (csvContent === null || csvContent === undefined || String(csvContent).trim() === '') {
      throw new BusinessError('CSV 内容为空');
    }
    const content = csvContent.startsWith('\uFEFF') ? csvContent.slice(1) : csvContent;
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) {
      throw new BusinessError('CSV 至少需要表头行与一行数据');
    }
    let count = 0;
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (line === '') {
        continue;
      }
      const cols = parseCsvLine(line);
      if (cols.length < 25) {
        throw new BusinessError(`第 ${i + 1} 行列数不足，期望至少 25 列，实际 ${cols.length} 列`);
      }
      const year = parseIntCell(cols[0], i + 1, '年份');
      const month =
        cols[1].trim() === '年终奖'
          ? salaryCalc.ANNUAL_BONUS_MONTH
          : parseIntCell(cols[1], i + 1, '月份');
      const request = {
        year,
        month,
        baseSalary: fromCents(parseMoneyCell(cols[2])),
        performanceSalary: fromCents(parseMoneyCell(cols[3])),
        housingAllowance: fromCents(parseMoneyCell(cols[4])),
        mealAllowance: fromCents(parseMoneyCell(cols[5])),
        transportAllowance: fromCents(parseMoneyCell(cols[6])),
        overtimePay: fromCents(parseMoneyCell(cols[7])),
        overtimeAllowance: fromCents(parseMoneyCell(cols[8])),
        bonus: fromCents(parseMoneyCell(cols[9])),
        medicalBase: fromCents(parseMoneyCell(cols[11])),
        pensionUnemploymentBase: fromCents(parseMoneyCell(cols[12])),
        housingFundBase: fromCents(parseMoneyCell(cols[13])),
        medicalDeduction: fromCents(parseMoneyCell(cols[14])),
        pensionDeduction: fromCents(parseMoneyCell(cols[15])),
        unemploymentDeduction: fromCents(parseMoneyCell(cols[16])),
        housingFundDeduction: fromCents(parseMoneyCell(cols[17])),
        incomeTax: fromCents(parseMoneyCell(cols[20])),
        seriousIllnessMedical: fromCents(parseMoneyCell(cols[22])),
        heatingAllowance: fromCents(parseMoneyCell(cols[23])),
        netPay: fromCents(parseMoneyCell(cols[24])),
        remark: cols.length > 25 ? unescapeCsv(cols[25]) : '',
      };
      const columns = this.#applyRequest(request);
      // Imported files carry the derived columns explicitly; store them as overrides.
      columns.grossPay = parseMoneyCell(cols[10]);
      columns.totalDeduction = parseMoneyCell(cols[18]);
      columns.preTaxSalary = parseMoneyCell(cols[19]);
      columns.afterTaxSalary = parseMoneyCell(cols[21]);
      const existing = this.repository.findByUserYearMonth(userId, year, month);
      if (existing) {
        this.repository.update(existing.id, userId, columns);
      } else {
        this.repository.insert({ userId, ...columns });
      }
      count += 1;
    }
    return count;
  }

  /**
   * Run the shared query resolving the (optional) year range.
   *
   * @param {number} userId - Owner id.
   * @param {number} [startYear] - Optional start year.
   * @param {number} [endYear] - Optional end year.
   * @returns {object[]} Matching records.
   */
  #query(userId, startYear, endYear) {
    const hasStart = startYear !== null && startYear !== undefined;
    const hasEnd = endYear !== null && endYear !== undefined;
    if (!hasStart && !hasEnd) {
      return this.repository.findByUser(userId);
    }
    let sy = hasStart ? startYear : endYear;
    let ey = hasEnd ? endYear : startYear;
    if (sy > ey) {
      [sy, ey] = [ey, sy];
    }
    if (sy === ey) {
      return this.repository.findByUserAndYear(userId, sy);
    }
    return this.repository.findByUserAndYearBetween(userId, sy, ey);
  }

  /**
   * Build the export filename for the given year range.
   *
   * @param {number} [startYear] - Optional start year.
   * @param {number} [endYear] - Optional end year.
   * @returns {string} Filename.
   */
  #buildExportFilename(startYear, endYear) {
    if (
      (startYear === null || startYear === undefined) &&
      (endYear === null || endYear === undefined)
    ) {
      return 'salary_all.csv';
    }
    let sy = startYear ?? endYear;
    let ey = endYear ?? startYear;
    if (sy > ey) {
      [sy, ey] = [ey, sy];
    }
    return sy === ey ? `salary_${sy}.csv` : `salary_${sy}-${ey}.csv`;
  }

  /**
   * CSV label for a record's month (年终奖 for annual bonus).
   *
   * @param {object} record - Salary record.
   * @returns {string} Month label.
   */
  #monthLabel(record) {
    return salaryCalc.isAnnualBonus(record) ? '年终奖' : String(record.month);
  }

  /**
   * Build the persisted column values from a request (money → cents, derived cleared).
   *
   * @param {object} request - Salary request.
   * @returns {object} Column values (cents; derived fields null).
   */
  #applyRequest(request) {
    const toCentsField = (value) => Math.round(Number(value ?? 0) * 100);
    const columns = {
      year: request.year,
      month: request.month,
      remark: request.remark === null || request.remark === undefined ? '' : request.remark,
      grossPay: null,
      totalDeduction: null,
      preTaxSalary: null,
      afterTaxSalary: null,
    };
    for (const key of EARNING_KEYS) {
      columns[key] = toCentsField(request[key]);
    }
    columns.medicalBase = toCentsField(request.medicalBase);
    columns.pensionUnemploymentBase = toCentsField(request.pensionUnemploymentBase);
    columns.housingFundBase = toCentsField(request.housingFundBase);
    columns.medicalDeduction = toCentsField(request.medicalDeduction);
    columns.pensionDeduction = toCentsField(request.pensionDeduction);
    columns.unemploymentDeduction = toCentsField(request.unemploymentDeduction);
    columns.housingFundDeduction = toCentsField(request.housingFundDeduction);
    columns.incomeTax = toCentsField(request.incomeTax);
    columns.seriousIllnessMedical = toCentsField(request.seriousIllnessMedical);
    columns.heatingAllowance = toCentsField(request.heatingAllowance);
    columns.netPay = toCentsField(request.netPay);
    return columns;
  }

  /**
   * Convert a salary record entity into a response object (cents → numbers).
   *
   * @param {object} r - Salary record (money in cents).
   * @returns {object} Salary response.
   */
  #toResponse(r) {
    return {
      id: r.id,
      year: r.year,
      month: r.month,
      annualBonus: salaryCalc.isAnnualBonus(r),
      baseSalary: fromCents(r.baseSalary ?? 0),
      performanceSalary: fromCents(r.performanceSalary ?? 0),
      housingAllowance: fromCents(r.housingAllowance ?? 0),
      mealAllowance: fromCents(r.mealAllowance ?? 0),
      transportAllowance: fromCents(r.transportAllowance ?? 0),
      overtimePay: fromCents(r.overtimePay ?? 0),
      overtimeAllowance: fromCents(r.overtimeAllowance ?? 0),
      bonus: fromCents(r.bonus ?? 0),
      medicalBase: fromCents(r.medicalBase ?? 0),
      pensionUnemploymentBase: fromCents(r.pensionUnemploymentBase ?? 0),
      housingFundBase: fromCents(r.housingFundBase ?? 0),
      medicalDeduction: fromCents(r.medicalDeduction ?? 0),
      pensionDeduction: fromCents(r.pensionDeduction ?? 0),
      unemploymentDeduction: fromCents(r.unemploymentDeduction ?? 0),
      housingFundDeduction: fromCents(r.housingFundDeduction ?? 0),
      incomeTax: fromCents(r.incomeTax ?? 0),
      seriousIllnessMedical: fromCents(r.seriousIllnessMedical ?? 0),
      heatingAllowance: fromCents(r.heatingAllowance ?? 0),
      grossPay: fromCents(salaryCalc.grossPay(r)),
      totalDeduction: fromCents(salaryCalc.totalDeduction(r)),
      preTaxSalary: fromCents(salaryCalc.preTaxSalary(r)),
      afterTaxSalary: fromCents(salaryCalc.afterTaxSalary(r)),
      netPay: fromCents(salaryCalc.netPay(r)),
      remark: r.remark,
    };
  }
}

export default SalaryService;
