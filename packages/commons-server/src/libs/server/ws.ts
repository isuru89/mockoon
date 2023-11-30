import {
  Route,
  RouteResponse,
  ServerErrorCodes,
  ServerEvents
} from '@mockoon/commons';
import { readFile } from 'fs';
import TypedEventEmitter from 'typed-emitter';
import { WebSocket } from 'ws';

export type DelegatedTemplateParser = (content: string) => string;

export const isWebSocketOpen = (socket: WebSocket): boolean =>
  socket.readyState === WebSocket.OPEN;

export const serveFileContentInWs = (
  socket: WebSocket,
  route: Route,
  routeResponse: RouteResponse,
  eventEmitter: TypedEventEmitter<ServerEvents>,
  templateParser: DelegatedTemplateParser
) => {
  const filePath = templateParser(routeResponse.filePath.replace(/\\/g, '/'));

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
      socket.close();
    } else {
      let fileContent = fileData.toString();
      if (!routeResponse.disableTemplating) {
        fileContent = templateParser(fileContent);
      }

      socket.send(fileContent);
    }
  });
};
