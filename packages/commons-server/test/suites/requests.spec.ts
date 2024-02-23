import { expect } from 'chai';
import { Request } from 'express';
import { ParamsDictionary, Query } from 'express-serve-static-core';
import { IncomingMessage } from 'http';
import {
  fromExpressRequest,
  fromServerRequest,
  fromWsRequest
} from '../../src/libs/requests';

describe('Requests', () => {
  describe('fromExpressRequest', () => {
    it('should create ServerRequest correctly from empty express request', () => {
      const req = {} as Request;
      const result = fromExpressRequest(req);
      expect(result.body).to.be.undefined;
      expect(result.stringBody).to.be.equal('');
      expect(result.cookies).to.be.undefined;
      expect(result.hostname).to.be.undefined;
      expect(result.ip).to.be.undefined;
      expect(result.method).to.be.undefined;
      expect(result.params).to.be.undefined;
      expect(result.query).to.be.undefined;
      expect(result.header).to.be.not.undefined;
      expect(result.get).to.be.not.undefined;

      expect(result.header('content-type')).to.be.undefined;
      expect(result.get('content-type')).to.be.undefined;
    });

    it('should return body and stringBody correctly', () => {
      const req = {
        body: { a: 1, text: 'hello' },
        stringBody: "{ a: 1, text: 'hello' }"
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.body).to.be.deep.equals({ a: 1, text: 'hello' });
      expect(result.stringBody).to.be.equals("{ a: 1, text: 'hello' }");
    });

    it('should return cookies correctly', () => {
      const req = {
        cookies: { 'session-id': 'abc' }
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.cookies).to.be.deep.equals({ 'session-id': 'abc' });
    });

    it('should return headers correctly and should return via header and get methods', () => {
      const headers = {
        'content-type': 'application/json',
        accept: 'text/html'
      };
      const req = {
        header: (name: string) => headers[name]
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.header('content-type')).to.be.equals('application/json');
      expect(result.get('content-type')).to.be.equals('application/json');
      expect(result.get('non-existence-header')).to.be.undefined;
    });

    it('should return params correctly', () => {
      const req = {
        params: {
          path1: 'value1',
          path2: 'value2'
        } as ParamsDictionary
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.params).to.be.deep.equals({
        path1: 'value1',
        path2: 'value2'
      });
    });

    it('should return queries correctly', () => {
      const req = {
        query: {
          search: 'abc',
          range: '1'
        } as Query
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.query).to.be.deep.equals({
        search: 'abc',
        range: '1'
      });
    });

    it('should return hostname, ip and method correctly', () => {
      const req = {
        hostname: 'localhost',
        ip: '127.0.0.2',
        method: 'GET'
      } as Request;
      const result = fromExpressRequest(req);
      expect(result.hostname).to.be.equals('localhost');
      expect(result.ip).to.be.equals('127.0.0.2');
      expect(result.method).to.be.equals('GET');
    });
  });

  describe('fromWsRequest', () => {
    it('should parse url correctly from http IncomingMessage', () => {
      const req = {
        url: 'api/path1/test?q=1&p=abc'
      } as IncomingMessage;
      const result = fromWsRequest(req);
      expect(result.query).to.be.deep.equals({ q: '1', p: 'abc' });
      expect(result.params).to.be.deep.equals({});
      expect(result.originalRequest).to.be.equals(req);
    });

    it('should return body and stringBody correctly when message is not given', () => {
      const req = {
        url: 'api/path1/test?q=1&p=abc',
        body: { a: 1, text: 'hello' }
      } as IncomingMessage;
      const result = fromWsRequest(req);
      expect(result.body).to.be.deep.equals({ a: 1, text: 'hello' });
      expect(result.stringBody).to.be.equal(
        JSON.stringify({ a: 1, text: 'hello' })
      );
    });

    it('should return body and stringBody correctly when message is given', () => {
      const req = {
        url: 'api/path1/test?q=1&p=abc',
        body: { a: 1, text: 'hello' },
        headers: {
          'content-type': 'application/json'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage;
      const result = fromWsRequest(
        req,
        JSON.stringify({ b: 2, hello: 'world' })
      );
      expect(result.body).to.be.deep.equals({ b: 2, hello: 'world' });
      expect(result.stringBody).to.be.equal(
        JSON.stringify({ b: 2, hello: 'world' })
      );
    });

    it('should parse headers and metadata correctly', () => {
      const req = {
        url: 'api/path1/test?q=1&p=abc',
        headers: {
          'content-type': 'application/json',
          accept: 'text/html'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage;
      const result = fromWsRequest(req);
      expect(result.header('content-type')).to.be.equals('application/json');
      expect(result.get('accept')).to.be.equals('text/html');
      expect(result.get('non-existence-header')).to.be.undefined;
      expect(result.hostname).to.be.undefined;
      expect(result.ip).to.be.undefined;
    });

    it('should parse hostname and ip from headers if specified', () => {
      const req = {
        headers: {
          'content-type': 'application/json',
          accept: 'text/html',
          host: 'localhost',
          'x-forwarded-for': '192.168.1.1'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage;
      const result = fromWsRequest(req);
      expect(result.hostname).to.be.equal('localhost');
      expect(result.ip).to.be.equal('192.168.1.1');
    });

    it('should cookies will always be null', () => {
      const req = {} as IncomingMessage;
      const result = fromWsRequest(req);
      expect(result.cookies).to.be.null;
    });
  });

  describe('fromServerRequest', () => {
    it('should always have root request as the original request', () => {
      const originalReq = {
        url: 'api/path1/test?q=1&p=abc',
        headers: {
          'content-type': 'application/json'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage;
      const req = fromWsRequest(originalReq);
      const result = fromServerRequest(
        req,
        JSON.stringify({ b: 2, hello: 'world' })
      );

      expect(result.originalRequest).to.be.equals(originalReq);
    });

    it('should return empty when no message or no body is specified', () => {
      const req = fromWsRequest({
        url: 'api/path1/test?q=1&p=abc',
        headers: {
          'content-type': 'application/json'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage);
      const result = fromServerRequest(req);

      expect(result.body).to.be.undefined;
      expect(result.stringBody).to.be.equal('');
    });

    it('should update body and stringBody correctly when parsing from existing request', () => {
      const req = fromWsRequest({
        url: 'api/path1/test?q=1&p=abc',
        body: { a: 1, text: 'hello' },
        headers: {
          'content-type': 'application/json'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage);
      const result = fromServerRequest(
        req,
        JSON.stringify({ b: 2, hello: 'world' })
      );

      expect(result.body).to.be.deep.equals({ b: 2, hello: 'world' });
      expect(result.stringBody).to.be.equals(
        JSON.stringify({ b: 2, hello: 'world' })
      );
      // other props should remain as it is
      expect(result.query).to.be.deep.equals({ q: '1', p: 'abc' });
      expect(result.params).to.be.deep.equals({});
      expect(result.header('content-type')).to.be.equals('application/json');
      expect(result.get('content-type')).to.be.equals('application/json');
    });

    it('should fallback to original body and stringBody is message is not given', () => {
      const req = fromWsRequest({
        url: 'api/path1/test?q=1&p=abc',
        body: { a: 1, text: 'hello' },
        headers: {
          'content-type': 'application/json'
        } as NodeJS.Dict<string | string[]>
      } as IncomingMessage);
      const result = fromServerRequest(req);

      expect(result.body).to.be.deep.equals({ a: 1, text: 'hello' });
      expect(result.stringBody).to.be.equals(
        JSON.stringify({ a: 1, text: 'hello' })
      );
    });
  });
});
