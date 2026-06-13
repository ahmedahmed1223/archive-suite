export const localSessionProvider = {
  async signIn() {
    throw new Error("الجلسة المحلية مملوكة لمخزن المصادقة المحلية.");
  },
  async signOut() {
    return true;
  },
  getCurrentUser() {
    return null;
  },
  getToken() {
    return "";
  },
  onChange() {
    return () => {};
  }
};
