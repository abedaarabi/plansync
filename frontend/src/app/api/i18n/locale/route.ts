/**
 * Same behavior as `POST /api/locale` — dedicated path so this route is never confused with
 * `api/[[...path]]` proxying to the backend.
 */
import { postLocaleCookie } from "@/lib/i18n/postLocaleCookie";

export const POST = postLocaleCookie;
