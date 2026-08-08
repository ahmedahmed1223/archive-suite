import type { DictionaryShape } from "../../types";
import type { auth as arabicAuth } from "../ar/auth";

export const auth = {
  errors: {
    sessionExpired: "Your session has expired. Sign in again.",
  },
  status: {
    verifyingSession: "Checking your session…",
    redirectingToLogin: "Taking you to sign in…",
  },
} as const satisfies DictionaryShape<typeof arabicAuth>;
