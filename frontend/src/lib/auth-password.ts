import { z } from "zod";

/** Min length for new passwords (signup, invite join, reset). */
const AUTH_PASSWORD_MIN_LENGTH = 10;

export const AUTH_PASSWORD_HINT =
  "At least 10 characters, with upper and lowercase letters, a number, and a symbol.";

const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

function isStrongAuthPassword(password: string): boolean {
  return (
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    HAS_LOWER.test(password) &&
    HAS_UPPER.test(password) &&
    HAS_DIGIT.test(password) &&
    HAS_SYMBOL.test(password)
  );
}

/** Zod field for creating / resetting a password (not for sign-in). */
export const strongAuthPasswordSchema = z
  .string()
  .min(1, "Enter a password.")
  .min(
    AUTH_PASSWORD_MIN_LENGTH,
    `Password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`,
  )
  .refine(isStrongAuthPassword, {
    message: AUTH_PASSWORD_HINT,
  });
