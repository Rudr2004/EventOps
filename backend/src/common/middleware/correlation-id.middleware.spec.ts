import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from './correlation-id.middleware.js';

function buildRequest(headerValue?: string) {
  return {
    header: vi.fn().mockReturnValue(headerValue),
    correlationId: undefined as string | undefined,
  };
}

function buildResponse() {
  return { setHeader: vi.fn() };
}

describe('CorrelationIdMiddleware', () => {
  it('generates a new correlation id when the client sends none', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = buildRequest(undefined);
    const res = buildResponse();
    const next = vi.fn();

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).toBeTruthy();
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req.correlationId);
    expect(next).toHaveBeenCalled();
  });

  it('reuses the correlation id supplied by the client', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = buildRequest('client-supplied-id');
    const res = buildResponse();
    const next = vi.fn();

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).toBe('client-supplied-id');
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'client-supplied-id');
  });

  it('generates a new id when the client header is blank', () => {
    const middleware = new CorrelationIdMiddleware();
    const req = buildRequest('   ');
    const res = buildResponse();
    const next = vi.fn();

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).not.toBe('   ');
    expect(req.correlationId).toBeTruthy();
  });
});
