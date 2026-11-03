import { Module } from '@nestjs/common';
import { GradingModule } from '../grading/grading.module';
import { WritingEvalModule } from '../writing-eval/writing-eval.module';
import { RecallGraderService } from './recall-grader.service';

/** Typed-recall questions + grading shared by Reviews, Assessments and Practice. */
@Module({
  imports: [GradingModule, WritingEvalModule],
  providers: [RecallGraderService],
  exports: [RecallGraderService],
})
export class RecallModule {}
