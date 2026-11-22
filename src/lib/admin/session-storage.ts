/**
 * Amplify's Cognito token store writes the access token, ID token, and
 * refresh token as one bundle. This adapter is that store's backing
 * storage. It is not a second token database.
 */
export function createSessionKeyValueStorage() {
  const keys = new Set<string>();

  return {
    async setItem(key: string, value: string) {
      window.sessionStorage.setItem(key, value);
      keys.add(key);
    },
    async getItem(key: string) {
      return window.sessionStorage.getItem(key);
    },
    async removeItem(key: string) {
      window.sessionStorage.removeItem(key);
      keys.delete(key);
    },
    async clear() {
      for (const key of keys) {
        window.sessionStorage.removeItem(key);
      }
      keys.clear();
    },
  };
}
