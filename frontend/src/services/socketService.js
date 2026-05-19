import { io } from 'socket.io-client';
import { getAuthToken } from '../utils/authStorage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

class SocketService {
  socket = null;

  listeners = new Set();

  notify() {
    this.listeners.forEach((fn) => fn(this.socket));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  connect() {
    const token = getAuthToken();
    if (!token) return;

    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.connect();
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      if (import.meta.env.DEV) {
        console.log('Connected to socket server');
      }
      this.notify();
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    this.socket.on('disconnect', () => {
      if (import.meta.env.DEV) {
        console.log('Disconnected from socket server');
      }
      this.notify();
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.notify();
    }
  }

  getSocket() {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService;
