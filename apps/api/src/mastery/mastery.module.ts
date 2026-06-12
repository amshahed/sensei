import { Module } from '@nestjs/common';
import { MasteryService } from './mastery.service';

@Module({
  providers: [MasteryService],
  exports: [MasteryService],
})
export class MasteryModule {}
