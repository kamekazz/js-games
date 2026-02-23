/**
 * Simple API client that handles CSRF tokens and session cookies for Django.
 */
export class ApiClient {
  constructor() {
    this._csrfToken = null;
  }

  _getCsrfToken() {
    if (this._csrfToken) return this._csrfToken;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : null;
  }

  async _ensureCsrf() {
    if (this._getCsrfToken()) return;
    // Hit a GET endpoint to get the CSRF cookie set
    await fetch('/api/health/', { credentials: 'same-origin' });
    this._csrfToken = this._getCsrfToken();
  }

  async get(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    return res;
  }

  async post(url, data) {
    await this._ensureCsrf();
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': this._getCsrfToken() || '',
      },
      body: JSON.stringify(data),
    });
    return res;
  }

  async delete(url) {
    await this._ensureCsrf();
    const res = await fetch(url, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'X-CSRFToken': this._getCsrfToken() || '',
      },
    });
    return res;
  }
}

// Singleton
export const api = new ApiClient();
