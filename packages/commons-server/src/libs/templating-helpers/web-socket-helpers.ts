import { Environment } from '@mockoon/commons';
import { SafeString } from 'handlebars';
import { IncomingMessage } from 'http';
import { JSONPath } from 'jsonpath-plus';
import { get as objectGet } from 'object-path';
import { parse as parseUrl } from 'url';
import { RawData } from 'ws';
import { xml2js } from 'xml-js';
import { ParsedXMLBodyMimeTypes } from '../../constants/common.constants';
import { convertPathToArray, stringIncludesArrayItems } from '../utils';

export const requestHelperNames: (keyof ReturnType<typeof WebSocketHelpers>)[] =
  [
    'bodyRaw',
    'body',
    'method',
    'ip',
    'queryParam',
    'queryParamRaw',
    'header',
    'baseUrl'
  ];

export const getRawWebSocketBodyAsString = (message?: RawData): string => {
  if (!message) {
    return '';
  }
  if (Array.isArray(message)) {
    return Buffer.concat(message).toString('utf8');
  }

  return message.toString('utf8');
};

export const parseWebSocketMessage = (
  request: IncomingMessage,
  messageData: string
): any => {
  const contentType = request.headers['content-type'];
  if (contentType) {
    if (contentType.includes('application/json')) {
      return JSON.parse(messageData);
    } else if (stringIncludesArrayItems(ParsedXMLBodyMimeTypes, contentType)) {
      return xml2js(messageData, { compact: true });
    }
  }

  return messageData;
};

export const WebSocketHelpers = function (
  request: IncomingMessage,
  messageData?: RawData,
  environment?: Environment
) {
  const location = parseUrl(request.url || '', true);

  // for simplicity, we suppport only json, xml or raw types only.
  const rawMessageBody = getRawWebSocketBodyAsString(messageData);
  const message = parseWebSocketMessage(request, rawMessageBody);

  return {
    // get json property from body
    body: function (
      path: string | string[] | null,
      defaultValue: string,
      stringify: boolean
    ) {
      // no path provided
      if (typeof path === 'object') {
        path = null;
      }

      // no default value provided
      if (typeof defaultValue === 'object') {
        defaultValue = '';
      }

      // no value for stringify provided
      if (typeof stringify === 'object') {
        stringify = false;
      }

      // if no path has been provided we want the full raw body as is
      if (path == null || path === '') {
        return new SafeString(rawMessageBody);
      }

      let source;

      if (messageData) {
        source = message;
      } else {
        return new SafeString(
          stringify ? JSON.stringify(defaultValue) : defaultValue
        );
      }

      if (typeof path === 'string' && path.startsWith('$')) {
        const values = JSONPath({ json: source, path: path });
        if (values && values.length > 0) {
          return new SafeString(JSON.stringify(values));
        }
      }

      if (typeof path === 'string') {
        path = convertPathToArray(path);
      }

      let value = objectGet(source, path);
      value = value === undefined ? defaultValue : value;

      if (Array.isArray(value) || typeof value === 'object') {
        stringify = true;
      }

      return new SafeString(stringify ? JSON.stringify(value) : value);
    },
    // get the raw json property from body to use with each for example
    bodyRaw: function (...args: any[]) {
      let path: string | string[] | null = null;
      let defaultValue = '';
      const parameters = args.slice(0, -1); // remove last item (handlebars options argument)

      if (parameters.length === 1) {
        path = parameters[0];
      } else if (parameters.length >= 2) {
        path = parameters[0];
        defaultValue = parameters[1];
      }

      if (messageData) {
        // if no path has been provided we want the full raw body as is
        if (path == null || path === '') {
          return rawMessageBody;
        }

        if (typeof path === 'string' && path.startsWith('$')) {
          const values = JSONPath({
            json: message,
            path: path
          });
          if (values && values.length > 0) {
            return values;
          }
        }

        if (typeof path === 'string') {
          path = convertPathToArray(path);
        }

        const value = objectGet(message, path);

        return value !== undefined ? value : defaultValue;
      } else {
        return defaultValue;
      }
    },

    // use params from query string ?param1=xxx&param2=yyy
    queryParam: function (
      path: string | string[],
      defaultValue: string,
      stringify: boolean
    ) {
      // no path provided
      if (typeof path === 'object') {
        path = '';
      }

      // no default value provided
      if (typeof defaultValue === 'object' || !defaultValue) {
        defaultValue = '';
      }

      // no value for stringify provided
      if (typeof stringify === 'object') {
        stringify = false;
      }

      const query = location.query || {};
      if (!query) {
        return new SafeString(
          stringify ? JSON.stringify(defaultValue) : defaultValue
        );
      }

      // if no path has been provided we want the full query string object as is
      if (!path) {
        return new SafeString(JSON.stringify(query));
      }

      if (typeof path === 'string' && path.startsWith('$')) {
        const values = JSONPath({ json: query, path: path });
        if (values && values.length > 0) {
          return new SafeString(JSON.stringify(values));
        }
      }

      if (typeof path === 'string') {
        path = convertPathToArray(path);
      }

      let value = objectGet(query, path);
      value = value === undefined ? defaultValue : value;

      if (Array.isArray(value) || typeof value === 'object') {
        stringify = true;
      }

      return new SafeString(stringify ? JSON.stringify(value) : value);
    },

    // use raw params from query string ?param1=xxx&param2=yyy
    queryParamRaw: function (...args: any[]) {
      let path: string | string[] = '';
      let defaultValue = '';
      const parameters = args.slice(0, -1); // remove last item (handlebars options argument)

      if (parameters.length === 1) {
        path = parameters[0];
      } else if (parameters.length >= 2) {
        path = parameters[0];
        defaultValue = parameters[1];
      }

      const query = location.query || {};
      if (!query) {
        return defaultValue;
      }

      // if no path has been provided we want the full raw query object as is
      if (!path) {
        return location.search;
      }

      if (typeof path === 'string' && path.startsWith('$')) {
        const values = JSONPath({ json: query, path: path });
        if (values && values.length > 0) {
          return values;
        }
      }

      if (typeof path === 'string') {
        path = convertPathToArray(path);
      }

      let value = objectGet(query, path);
      value = value === undefined ? defaultValue : value;

      return value;
    },

    // use content from request header
    header: function (headerName: string, defaultValue: string) {
      if (typeof defaultValue === 'object') {
        defaultValue = '';
      }

      if (typeof headerName === 'object') {
        return defaultValue;
      }

      return request.headers[headerName] || defaultValue;
    },
    // base url
    baseUrl: function () {
      return request.headers['host'];
    },
    // use request ip
    ip: function () {
      return request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    },
    // use request method
    method: function () {
      return request.method;
    }
  };
};
