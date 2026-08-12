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
  login: {
    title: "Sign in",
    loading: "Preparing the sign-in page…",
    portal: "Sign-in portal",
    heading: "Sign in to Masar",
    description: "A secure, focused gateway to the records and media workspace.",
    form: "Sign-in form",
    credentials: "Sign-in details",
    credentialsDescription: "Use your account to continue to the dashboard.",
    email: "Email address",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    remember: "Remember me on this device",
    rememberHint: "Do not enable this on a shared device.",
    submit: "Sign in",
    submitting: "Signing in…",
    gettingStarted: "Getting started",
    secureSession: "Your session is stored in a secure cookie, and the workspace stays hidden until you are authenticated.",
    emailPlaceholder: "your@email.com",
    successTitle: "Signed in successfully",
    successDescription: "You will now be redirected to the workspace.",
    failureTitle: "Sign-in failed",
    checkServer: "Check server status",
    returnToSetup: "Return to setup journey",
    currentTime: "Current time",
  },
} as const satisfies DictionaryShape<typeof arabicAuth>;
