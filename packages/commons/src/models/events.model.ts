import { ServerErrorCodes } from '../enums/errors.enum';
import { InvokedCallback, Transaction } from './server.model';

export type ServerEvents = {
  error: (
    errorCode: ServerErrorCodes,
    originalError: Error | null,
    /**
     * Additional payload to surface some info from the server (route UUID, etc.)
     */
    payload?: any
  ) => void;
  stopped: () => void;
  'creating-proxy': () => void;
  started: () => void;
  'entering-request': () => void;
  'callback-invoked': (callback: InvokedCallback) => void;
  'transaction-complete': (transaction: Transaction) => void;

  /**
   * Web socket related events
   */
  'ws-new-connection': (websocketId: string) => void;
  'ws-closed': (
    websocketId: string,
    wsCode: number,
    reason?: string | null
  ) => void;
  'ws-message-received': (websocketId: string) => void;
};
