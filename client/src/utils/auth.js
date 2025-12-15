const TOKEN_KEY = 'auth_token';

export function storeToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeader(token = getToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}


