import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Emits one structured log line per request, tagged with the correlation id
 * set by CorrelationIdMiddleware, so logs for a single client request can be
 * traced across the auth guard, the handler, and (once it exists) any
 * downstream analytics/cache calls.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, correlationId } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            this.formatLine(method, originalUrl, response.statusCode, Date.now() - start, correlationId),
          );
        },
        error: (error: unknown) => {
          const status = response.statusCode >= 400 ? response.statusCode : 500;
          this.logger.error(
            this.formatLine(method, originalUrl, status, Date.now() - start, correlationId),
            error instanceof Error ? error.stack : undefined,
          );
        },
      }),
    );
  }

  private formatLine(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    correlationId: string | undefined,
  ): string {
    return `${method} ${url} ${statusCode} ${durationMs}ms correlationId=${correlationId ?? 'unknown'}`;
  }
}
