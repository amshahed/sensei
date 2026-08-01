import { Module } from '@nestjs/common';
import { WritingEvalService } from './writing-eval.service';

@Module({
  providers: [WritingEvalService],
  exports: [WritingEvalService],
})
export class WritingEvalModule {}
