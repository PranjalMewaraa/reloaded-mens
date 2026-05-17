import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VariantsController } from './variants.controller.js';
import { VariantsService } from './variants.service.js';

@Module({
  imports: [AuthModule],
  controllers: [VariantsController],
  providers: [VariantsService],
})
export class VariantsModule {}
