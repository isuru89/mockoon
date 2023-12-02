import {
  Route,
  RouteResponse,
  ServerErrorCodes,
  ServerEvents
} from '@mockoon/commons';
import { readFile } from 'fs';
import TypedEventEmitter from 'typed-emitter';
import { RawData, WebSocket } from 'ws';

export type DelegatedTemplateParser = (content: string) => string;

/**
 * Convert incoming websocket message to string representation.
 *
 * @param message
 */
export const messageToString = (message?: RawData): string => {
  if (!message) {
    return '';
  }
  if (Array.isArray(message)) {
    return Buffer.concat(message).toString('utf8');
  }

  return message.toString('utf8');
};

/**
 * Returns true if the given socket client is still in open state.
 *
 * @param socket
 */
export const isWebSocketOpen = (socket: WebSocket): boolean =>
  socket.readyState === WebSocket.OPEN;

/**
 * Serve the content of the file as a response.
 * Will use templating if specified to do so.
 *
 * @param socket
 * @param route
 * @param routeResponse
 * @param eventEmitter
 * @param filePath
 * @param templateParser
 */
export const serveFileContentInWs = (
  socket: WebSocket,
  route: Route,
  routeResponse: RouteResponse,
  eventEmitter: TypedEventEmitter<ServerEvents>,
  filePath: string,
  templateParser: DelegatedTemplateParser
) => {
  readFile(filePath, (err, fileData) => {
    if (err) {
      eventEmitter.emit(
        'error',
        ServerErrorCodes.ROUTE_FILE_SERVING_ERROR,
        err,
        {
          routePath: route.endpoint,
          routeUUID: route.uuid
        }
      );

      // we close the socket if the provided file cannot be read.
      socket.send(`Status: 500, File reading error! (${err.message})`, () => {
        socket.close();
      });
    } else {
      let fileContent = fileData.toString();
      if (!routeResponse.disableTemplating) {
        fileContent = templateParser(fileContent);
      }

      socket.send(fileContent);
    }
  });
};
