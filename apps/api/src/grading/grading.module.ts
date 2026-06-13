import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { GradingService } from './grading.service';

@Module({
  imports: [LlmModule],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
