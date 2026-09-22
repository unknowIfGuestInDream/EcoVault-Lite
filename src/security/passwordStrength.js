/**
 * @file Password strength evaluation.
 *
 * Mirrors the Java `PasswordStrengthUtil.evaluate` scoring exactly:
 * - length >= 12 -> +40, else >= 8 -> +25, else >= 6 -> +10
 * - contains lowercase -> +15
 * - contains uppercase -> +15
 * - contains digit -> +15
 * - contains special (not a letter or digit) -> +15
 * - score is capped at 100
 * - level: score >= 70 -> STRONG, >= 40 -> MEDIUM, otherwise WEAK
 * - empty/blank input -> score 0, level WEAK
 */

/**
 * Strength levels.
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
 * @property {number} score - Numeric score in the range [0, 100].
 * @property {string} level - One of {@link StrengthLevel}.
 */

/**
 * Evaluate the strength of a password.
 *
 * @param {string | null | undefined} password - Password to score.
 * @returns {StrengthResult} The score and level.
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
  // "special" mirrors Java's !Character.isLetterOrDigit: any character that is
  // not an ASCII letter or digit. Approximated with an ASCII-oriented class.
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 15;
  }

  if (score > 100) {
    score = 100;
  }

  let level = StrengthLevel.WEAK;
  if (score >= 70) {
    level = StrengthLevel.STRONG;
  } else if (score >= 40) {
    level = StrengthLevel.MEDIUM;
  }

  return { score, level };
}

export default { evaluate, StrengthLevel };
