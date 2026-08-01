import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { GradingModule } from '../grading/grading.module';
import { WritingEvalModule } from '../writing-eval/writing-eval.module';
import { ChecksController } from './checks.controller';
import { ChecksService } from './checks.service';

@Module({
  imports: [MasteryModule, GradingModule, WritingEvalModule],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
