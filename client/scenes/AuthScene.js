import { api } from '@engine/network/ApiClient.js';

export class AuthScene {
  constructor(sceneManager, onAuthenticated) {
    this.sceneManager = sceneManager;
    this.onAuthenticated = onAuthenticated;
    this.el = null;
    this._mode = 'login'; // 'login' | 'register'
  }

  async enter(container) {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      pointer-events: auto; background: rgba(0,0,0,0.85); color: white; font-family: Arial, sans-serif;
    `;
    this._render();
    container.appendChild(this.el);
  }

  _render() {
    const isLogin = this._mode === 'login';
    this.el.innerHTML = `
      <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #ff4444;">ZOMBIE SURVIVAL</h1>
      <p style="color: #888; margin-bottom: 2rem;">${isLogin ? 'Sign in to play' : 'Create an account'}</p>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 280px;">
        <input id="auth-username" type="text" placeholder="Username" maxlength="30"
          style="padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: white; font-size: 16px; text-align: center;" />
        ${!isLogin ? `<input id="auth-display" type="text" placeholder="Display name" maxlength="30"
          style="padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: white; font-size: 16px; text-align: center;" />` : ''}
        <input id="auth-password" type="password" placeholder="Password"
          style="padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: white; font-size: 16px; text-align: center;" />
        <button id="auth-submit" style="padding: 14px; border-radius: 8px; border: none; background: #4488ff; color: white; font-size: 16px; font-weight: bold; cursor: pointer;">
          ${isLogin ? 'Sign In' : 'Register'}
        </button>
        <button id="auth-toggle" style="padding: 10px; border-radius: 8px; border: 1px solid #444; background: transparent; color: #888; font-size: 14px; cursor: pointer;">
          ${isLogin ? 'Need an account? Register' : 'Already have an account? Sign In'}
        </button>
        <button id="auth-guest" style="padding: 10px; border-radius: 8px; border: 1px solid #333; background: transparent; color: #666; font-size: 13px; cursor: pointer;">
          Play as Guest
        </button>
      </div>
      <p id="auth-error" style="color: #ff4444; margin-top: 12px; display: none; max-width: 280px; text-align: center;"></p>
    `;

    this.el.querySelector('#auth-submit').addEventListener('click', () => this._submit());
    this.el.querySelector('#auth-toggle').addEventListener('click', () => {
      this._mode = isLogin ? 'register' : 'login';
      this._render();
    });
    this.el.querySelector('#auth-guest').addEventListener('click', () => {
      this.onAuthenticated({ guest: true, display_name: 'Guest' });
    });

    // Submit on Enter
    this.el.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._submit();
      });
    });
  }

  async _submit() {
    const username = this.el.querySelector('#auth-username').value.trim();
    const password = this.el.querySelector('#auth-password').value;
    const errorEl = this.el.querySelector('#auth-error');

    if (!username || !password) {
      this._showError('Please fill in all fields.');
      return;
    }

    const btn = this.el.querySelector('#auth-submit');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
      if (this._mode === 'register') {
        const displayName = this.el.querySelector('#auth-display').value.trim();
        if (!displayName) {
          this._showError('Please enter a display name.');
          btn.disabled = false;
          btn.textContent = 'Register';
          return;
        }
        const res = await api.post('/api/auth/register/', {
          username, password, display_name: displayName,
        });
        if (!res.ok) {
          const data = await res.json();
          this._showError(this._extractError(data));
          btn.disabled = false;
          btn.textContent = 'Register';
          return;
        }
        const user = await res.json();
        this.onAuthenticated(user);
      } else {
        const res = await api.post('/api/auth/login/', { username, password });
        if (!res.ok) {
          const data = await res.json();
          this._showError(data.error || 'Login failed.');
          btn.disabled = false;
          btn.textContent = 'Sign In';
          return;
        }
        const user = await res.json();
        this.onAuthenticated(user);
      }
    } catch (e) {
      this._showError('Network error. Is the server running?');
      btn.disabled = false;
      btn.textContent = this._mode === 'login' ? 'Sign In' : 'Register';
    }
  }

  _showError(msg) {
    const el = this.el.querySelector('#auth-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  _extractError(data) {
    if (typeof data === 'string') return data;
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val)) return val[0];
      if (typeof val === 'string') return val;
    }
    return 'Registration failed.';
  }

  exit() {
    if (this.el) this.el.remove();
  }
}
