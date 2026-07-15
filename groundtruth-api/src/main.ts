import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGIN').split(','),
    allowedHeaders: ['Authorization', 'Content-Type', 'x-operador-id'],
  });
  app.enableShutdownHooks();

  await app.listen(config.getOrThrow<number>('PORT'));
}

bootstrap();
