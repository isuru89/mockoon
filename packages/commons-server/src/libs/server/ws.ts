import { WebSocket } from 'ws';

export const isWebSocketOpen = (socket: WebSocket): boolean =>
  socket.readyState === WebSocket.OPEN;
