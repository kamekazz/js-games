export class NetworkClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectDelay = 1000;
    this._url = null;
    this._shouldReconnect = false;
  }

  connect(url) {
    this._url = url;
    this._shouldReconnect = true;
    this._doConnect();
  }

  _doConnect() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this._url);

    this.ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._emit('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._emit(data.type, data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this._emit('close');
      if (this._shouldReconnect && this._reconnectAttempts < this._maxReconnectAttempts) {
        this._reconnectAttempts++;
        const delay = this._reconnectDelay * this._reconnectAttempts;
        console.log(`Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})...`);
        setTimeout(() => this._doConnect(), delay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  off(type, callback) {
    const cbs = this.listeners.get(type);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx !== -1) cbs.splice(idx, 1);
    }
  }

  _emit(type, data) {
    const cbs = this.listeners.get(type);
    if (cbs) {
      for (const cb of cbs) cb(data);
    }
  }

  disconnect() {
    this._shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
