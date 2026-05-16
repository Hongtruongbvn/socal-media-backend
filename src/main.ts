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

  // Cho phép truy cập file tĩnh (ảnh, video)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // CORS configuration (giữ nguyên của bạn)
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://172.20.10.3:8081',
      'exp://172.20.10.3:8081',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5173',
      'http://localhost:5172',
      'http://localhost:5171',
      'http://localhost:5170',
      'http://192.168.1.*', 
      '*'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ✅ SỬA LỖI: Lấy PORT từ biến môi trường, mặc định 8888 cho local
  const port = process.env.PORT || 8888;
  
  // ✅ BẮT BUỘC: Listen trên 0.0.0.0 để Render có thể route traffic
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
  console.log(`📡 API prefix: /api`);
  console.log(`🌐 CORS enabled for multiple origins`);
}
bootstrap();