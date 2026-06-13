import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  isLegacyHash
} from "../../../utils/passwordHash.js";

/**
 * The offline SPA auth adapter: the existing bcrypt/SHA credential utilities
 * exposed through the AuthProvider port shape. No behavior change — these are
 * the same functions the auth slice already uses.
 */
export const localAuthProvider = {
  hashSecret: hashPassword,
  verifySecret: verifyPassword,
  validateStrength: validatePasswordStrength,
  isLegacyHash
};
