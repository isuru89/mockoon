import {
  BodyTypes,
  Environment,
  ResponseMode,
  Route,
  RouteResponse
} from '@mockoon/commons';
import { expect } from 'chai';
import { IncomingMessage } from 'http';
import { fromWsRequest } from '../../../src/libs/requests';
import {
  BroadcastContext,
  DelegatedBroadcastHandler,
  SMALLEST_POSSIBLE_STREAMING_INTERVAL,
  ServerContext,
  WsRunningInstance,
  getSafeStreamingInterval
} from '../../../src/libs/server/ws';

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({});
    }, ms);
  });

const EMPTY_SERVER_CTX = {
  environment: {} as Environment,
  globalVariables: {},
  processedDatabuckets: []
} as ServerContext;

const EMPTY_WS_REQUEST = fromWsRequest({} as IncomingMessage);

describe('Minimum Streaming Interval', () => {
  it('minimum interval should not lower than 10ms', () => {
    expect(getSafeStreamingInterval(0)).to.be.equal(
      SMALLEST_POSSIBLE_STREAMING_INTERVAL
    );
    expect(getSafeStreamingInterval(-100)).to.be.equal(
      SMALLEST_POSSIBLE_STREAMING_INTERVAL
    );
    expect(getSafeStreamingInterval(9)).to.be.equal(
      SMALLEST_POSSIBLE_STREAMING_INTERVAL
    );
    expect(getSafeStreamingInterval(10)).to.be.equal(10);
    expect(getSafeStreamingInterval(11)).to.be.equal(11);
    expect(getSafeStreamingInterval(500)).to.be.equal(500);
    expect(getSafeStreamingInterval(1000)).to.be.equal(1000);
  });
});

describe('WS Streaming Runner', () => {
  const assertIsRunning = (runner: WsRunningInstance) =>
    expect(runner._isRunning).to.be.true;
  const assertNotRunning = (runner: WsRunningInstance) =>
    expect(runner._isRunning).to.be.false;

  it('should not fail if close() is called before start or repeatedly afterwards', async () => {
    const received = [] as string[];
    const handler: DelegatedBroadcastHandler = (
      _: number,
      routeResponse: RouteResponse
    ) => {
      received.push(routeResponse.body || '');
    };
    const route = {
      endpoint: '/api/test1',
      responses: [
        { bodyType: BodyTypes.INLINE, body: 'test 1' },
        { bodyType: BodyTypes.INLINE, body: 'test 2' },
        { bodyType: BodyTypes.INLINE, body: 'test 3' }
      ],
      responseMode: ResponseMode.SEQUENTIAL,
      streamingInterval: 10
    } as Route;

    const runner = new WsRunningInstance(
      route,
      EMPTY_SERVER_CTX,
      EMPTY_WS_REQUEST,
      handler
    );

    assertNotRunning(runner);
    runner.close();
    assertNotRunning(runner);

    // start and wait
    runner.run();
    assertIsRunning(runner);
    await sleep(200);
    assertIsRunning(runner);

    expect(received.length).to.be.greaterThan(0);

    // close and check
    runner.close();
    assertNotRunning(runner);
    runner.close();
    assertNotRunning(runner);
  });

  it('should be able to start after close() is called', async () => {
    const received = [] as string[];
    const handler: DelegatedBroadcastHandler = (
      _: number,
      routeResponse: RouteResponse
    ) => {
      received.push(routeResponse.body || '');
    };
    const route = {
      endpoint: '/api/test1',
      responses: [
        { bodyType: BodyTypes.INLINE, body: 'test 1' },
        { bodyType: BodyTypes.INLINE, body: 'test 2' },
        { bodyType: BodyTypes.INLINE, body: 'test 3' }
      ],
      responseMode: ResponseMode.SEQUENTIAL,
      streamingInterval: 10
    } as Route;

    const runner = new WsRunningInstance(
      route,
      EMPTY_SERVER_CTX,
      EMPTY_WS_REQUEST,
      handler
    );

    assertNotRunning(runner);

    // start and wait
    runner.run();
    await sleep(200);
    assertIsRunning(runner);

    expect(received.length).to.be.greaterThan(0);

    // close and check
    runner.close();

    // run again
    const prevLength = received.length;
    runner.run();
    await sleep(150);
    assertIsRunning(runner);

    runner.close();
    expect(prevLength).to.be.lessThan(received.length);
    assertNotRunning(runner);
  });
});

describe('Broadcast Context', () => {
  it('should be able to register a route and should never register twice', async () => {
    const brdCtx = BroadcastContext.getInstance();
    const received = [] as string[];
    const handler: DelegatedBroadcastHandler = (
      _: number,
      routeResponse: RouteResponse
    ) => {
      received.push(routeResponse.body || '');
    };
    const route = {
      endpoint: '/api/test1',
      responses: [
        { bodyType: BodyTypes.INLINE, body: 'test 1' },
        { bodyType: BodyTypes.INLINE, body: 'test 2' },
        { bodyType: BodyTypes.INLINE, body: 'test 3' }
      ],
      responseMode: ResponseMode.SEQUENTIAL,
      streamingInterval: 20
    } as Route;

    expect(brdCtx._runningInstances.size).to.be.equal(0);
    const added = brdCtx.registerRoute(
      route,
      EMPTY_SERVER_CTX,
      EMPTY_WS_REQUEST,
      handler
    );

    expect(added).to.be.true;
    expect(brdCtx._runningInstances.size).to.be.equal(1);

    // adding again should be unsuccessful
    expect(
      brdCtx.registerRoute(route, EMPTY_SERVER_CTX, EMPTY_WS_REQUEST, handler)
    ).to.be.false;
    expect(brdCtx._runningInstances.size).to.be.equal(1);

    await sleep(100);

    brdCtx.closeAll();
    expect(brdCtx._runningInstances.size).to.be.equal(0);
  });

  it('should be able to register route again after closing previous runners', async () => {
    const brdCtx = BroadcastContext.getInstance();
    const received = [] as string[];
    const handler: DelegatedBroadcastHandler = (
      _: number,
      routeResponse: RouteResponse
    ) => {
      received.push(routeResponse.body || '');
    };
    const route = {
      endpoint: '/api/test1',
      responses: [
        { bodyType: BodyTypes.INLINE, body: 'test 1' },
        { bodyType: BodyTypes.INLINE, body: 'test 2' },
        { bodyType: BodyTypes.INLINE, body: 'test 3' }
      ],
      responseMode: ResponseMode.SEQUENTIAL,
      streamingInterval: 20
    } as Route;

    expect(brdCtx._runningInstances.size).to.be.equal(0);
    expect(
      brdCtx.registerRoute(route, EMPTY_SERVER_CTX, EMPTY_WS_REQUEST, handler)
    ).to.be.true;

    await sleep(100);

    brdCtx.closeAll();
    expect(brdCtx._runningInstances.size).to.be.equal(0);

    expect(
      brdCtx.registerRoute(route, EMPTY_SERVER_CTX, EMPTY_WS_REQUEST, handler)
    ).to.be.true;

    brdCtx.closeAll();
    expect(brdCtx._runningInstances.size).to.be.equal(0);
  });
});
