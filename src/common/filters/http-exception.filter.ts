import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message
        : 'Internal server error';

    if (status === HttpStatus.BAD_REQUEST && !Array.isArray(message)) {
      message = [message];
    }
    const error =
      exception instanceof HttpException
        ? (exception.getResponse() as any).error
        : 'Server error';
    this.logger.error(
      `Http Status: ${status} Error Message: ${JSON.stringify(message)}`,
    );
    this.logger.error(
      "Error:",
      exception.getResponse()
    );
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
