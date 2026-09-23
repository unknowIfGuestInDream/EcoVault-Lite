/**
 * @file 密码强度评估。
 *
 * 密码强度评分方式：
 * - length >= 12 -> +40，否则 >= 8 -> +25，否则 >= 6 -> +10
 * - 包含小写字母 -> +15
 * - 包含大写字母 -> +15
 * - 包含数字 -> +15
 * - 包含特殊字符（不是字母或数字）-> +15
 * - score 上限为 100
 * - level：score >= 70 -> STRONG，>= 40 -> MEDIUM，否则 WEAK
 * - 空/空白输入 -> score 0，level WEAK
 */

/**
 * 强度等级。
 *
 * @readonly
 * @enum {string}
 */
export const StrengthLevel = Object.freeze({
  WEAK: 'WEAK',
  MEDIUM: 'MEDIUM',
  STRONG: 'STRONG',
});

/**
 * @typedef {object} StrengthResult
 * @property {number} score - 范围 [0, 100] 内的数字评分。
 * @property {string} level - {@link StrengthLevel} 之一。
 */

/**
 * 评估密码强度。
 *
 * @param {string | null | undefined} password - 要评分的密码。
 * @returns {StrengthResult} 评分和等级。
 */
export function evaluate(password) {
  if (password === null || password === undefined || password.length === 0) {
    return { score: 0, level: StrengthLevel.WEAK };
  }

  let score = 0;
  const length = password.length;
  if (length >= 12) {
    score += 40;
  } else if (length >= 8) {
    score += 25;
  } else if (length >= 6) {
    score += 10;
  }

  if (/[a-z]/.test(password)) {
    score += 15;
  }
  if (/[A-Z]/.test(password)) {
    score += 15;
  }
  if (/[0-9]/.test(password)) {
    score += 15;
  }
  // 特殊字符表示任何非 ASCII 字母或数字的字符。
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 15;
  }

  score = Math.min(score, 100);

  let level = StrengthLevel.WEAK;
  if (score >= 70) {
    level = StrengthLevel.STRONG;
  } else if (score >= 40) {
    level = StrengthLevel.MEDIUM;
  }

  return { score, level };
}

export default { evaluate, StrengthLevel };
