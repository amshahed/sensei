import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { RecallModule } from '../recall/recall.module';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [MasteryModule, RecallModule],
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}
