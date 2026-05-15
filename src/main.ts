// File: apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { CustomLogger } from './custom-logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new CustomLogger(),
  });
  app.useGlobalPipes(new ValidationPipe());

  // Cho phép truy cập file tĩnh (ảnh, video) - Dùng process.cwd() để trỏ đúng thư mục uploads gốc
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // CORS: chỉ cho phép front-end và bật credentials
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://172.20.10.3:8081', // ✅ IP của Expo
      'exp://172.20.10.3:8081',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5173',
      'http://localhost:5172',
      'http://localhost:5171',
      'http://localhost:5170',




      'http://192.168.1.*', 
      '*'// Cho phép tất cả IP trong mạng 192.168.1.x
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Tiền tố API
  app.setGlobalPrefix('api');

  // Bật validation toàn cục
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(8888);
}
bootstrap();
