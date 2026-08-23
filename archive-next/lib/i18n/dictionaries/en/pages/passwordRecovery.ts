export const passwordRecovery = {
  subtitle: "Password recovery",
  navLabel: "Help",
  eyebrow: "Help",
  title: "Forgot your password?",
  description: "The local deployment has no email recovery — follow one of the two paths below based on your role.",
  adminTitle: "Administrator? Reset the password from Control Center",
  adminSteps: [
    "Open the application folder on the server machine.",
    "Run setup.bat on Windows or setup.sh on Linux.",
    "Run the command change-admin-password --generate to mint a new password for the admin account.",
    "Share the new password over a trusted channel and ask the user to change it immediately.",
  ],
  adminCommand: "setup.bat change-admin-password --generate",
  selfTitle: "Not an administrator?",
  selfSteps: [
    "Contact your archive administrator and ask for a password reset.",
    "Once you receive the temporary password, sign in immediately and change it under Settings → Account.",
    "Pick a strong password you don't reuse elsewhere.",
  ],
  securityTitle: "Security note",
  securityBody:
    "Passwords are stored hashed and can never be retrieved as plain text — they can only be reset. Nobody at Masar will ever ask for your password by chat or email.",
  backToLogin: "Back to sign in",
  backToHelp: "Help center",
} as const;
