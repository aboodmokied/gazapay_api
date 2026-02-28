import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { PrismaService } from './providers/prisma/prisma.service';

import {
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  BadRequestErrorDto,
  UnauthorizedErrorDto,
  ForbiddenErrorDto,
  NotFoundErrorDto,
  ConflictErrorDto,
  InternalServerErrorDto,
} from './common/dto/api-response.dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security & Performance
  app.use(helmet());
  app.use(compression());

  // Global Pipes & Filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Offline Wallet API')
    .setDescription(
      `## Response Envelopes

**Success** — every successful response is wrapped by \`TransformInterceptor\`:
\`\`\`json
{ "statusCode": 200, "data": { ... } }
\`\`\`

**Error** — every error response is shaped by \`AllExceptionsFilter\`:
\`\`\`json
{ "statusCode": 400, "timestamp": "...", "path": "/...", "message": "..." }
\`\`\`

> See the **Schemas** section below for \`ApiSuccessResponseDto\`, \`ApiErrorResponseDto\`, and all specific error variants (400 / 401 / 403 / 404 / 409 / 500).`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      ApiSuccessResponseDto,
      ApiErrorResponseDto,
      BadRequestErrorDto,
      UnauthorizedErrorDto,
      ForbiddenErrorDto,
      NotFoundErrorDto,
      ConflictErrorDto,
      InternalServerErrorDto,
    ],
  });
  SwaggerModule.setup('api', app, document);

  // Prisma Shutdown Hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application listening on port ${port}`);
}
bootstrap();
