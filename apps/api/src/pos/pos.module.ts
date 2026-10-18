import { Module } from '@nestjs/common';
import { BillGenerator } from './bill.generator.js';
import { PosAuthGuard } from './pos-auth.guard.js';
import { PosController } from './pos.controller.js';
import { PosService } from './pos.service.js';

@Module({
  controllers: [PosController],
  providers: [PosService, BillGenerator, PosAuthGuard],
})
export class PosModule {}
