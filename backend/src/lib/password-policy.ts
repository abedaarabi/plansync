/** Shared with frontend auth forms — keep rules in sync with `frontend/src/lib/auth-password.ts`. */
export const AUTH_PASSWORD_MIN_LENGTH = 10;

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export const AUTH_PASSWORD_HINT =
  "At least 10 characters, with upper and lowercase letters, a number, and a symbol.";

export function isStrongAuthPassword(password: string): boolean {
  return (
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    HAS_LOWER.test(password) &&
    HAS_UPPER.test(password) &&
    HAS_DIGIT.test(password) &&
    HAS_SYMBOL.test(password)
  );
}
