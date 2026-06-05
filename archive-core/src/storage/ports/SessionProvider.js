/**
 * SessionProvider port — cloud/session identity lifecycle. Kept separate from
 * AuthProvider because AuthProvider owns credential hashing/verification while
 * this contract owns remote sign-in state and bearer tokens.
 *
 *  signIn({ username, password }) -> Promise<{ token, user }>
 *  signOut()                      -> Promise<boolean>
 *  getCurrentUser()               -> object|null
 *  getToken()                     -> string
 *  onChange(handler)              -> unsubscribe()
 */
export const SESSION_PROVIDER_METHODS = ["signIn", "signOut", "getCurrentUser", "getToken", "onChange"];

export function isSessionProvider(candidate) {
  return Boolean(candidate) && SESSION_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
