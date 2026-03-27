import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true, // Required for Stripe webhook signature verification
  });

  const configService = app.get(ConfigService);

  // ─── CORS ────────────────────────────────────────────────────────────────────
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // ─── Global API Prefix ───────────────────────────────────────────────────────
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/health', '/metrics'],
  });

  // ─── Global Pipes ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false,
    }),
  );

  // ─── Global Filters ──────────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global Interceptors ─────────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(reflector),
  );

  // ─── Trust Proxy (for accurate IP behind load balancers / reverse proxies) ───
  app.set('trust proxy', 1);

  // ─── Swagger / OpenAPI ───────────────────────────────────────────────────────
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Freelancer Platform API')
      .setDescription(
        `
## Overview
REST API for the Freelancer Platform — a marketplace connecting clients with freelancers.

## Authentication
Most endpoints require a **Bearer JWT** token.
Obtain a token via \`POST /auth/login\` or \`POST /auth/register\` then click **Authorize** above.

## Rate Limiting
All endpoints are rate-limited to **${configService.get('THROTTLE_LIMIT', 100)} requests / ${configService.get('THROTTLE_TTL', 60)}s** per IP.
      `.trim(),
      )
      .setVersion('1.0.0')
      .setContact(
        'Freelancer Platform Team',
        'https://github.com/your-org/freelancer-platform',
        'support@freelancerplatform.com',
      )
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addServer(`http://localhost:${configService.get('PORT', 4000)}`, 'Local Development')
      .addServer('https://api.freelancerplatform.com', 'Production')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter your JWT access token',
          in: 'header',
        },
        'access-token',
      )
      .addTag('Auth', 'Authentication & authorization endpoints')
      .addTag('Projects', 'Project listing, creation and management')
      .addTag('Bids', 'Bid placement and management')
      .addTag('Payments', 'Stripe payments, milestones and payouts')
      .addTag('Chat', 'Real-time messaging and conversations')
      .addTag('Notifications', 'In-app and email notifications')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
      deepScanRoutes: true,
    });

    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Freelancer Platform API Docs',
    });

    logger.log(
      `📄 Swagger docs available at http://localhost:${configService.get('PORT', 4000)}/${apiPrefix}/docs`,
    );
  }

  // ─── Start Server ────────────────────────────────────────────────────────────
  const port = configService.get<number>('PORT', 4000);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`⚡ WebSocket namespaces: /chat  /notifications`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application', err);
  process.exit(1);
});
