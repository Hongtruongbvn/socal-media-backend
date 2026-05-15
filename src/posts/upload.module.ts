import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController], // 📌 Controller phải nằm ở đây
})
export class UploadModule {}
