import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { GradingModule } from '../grading/grading.module';
import { MasteryModule } from '../mastery/mastery.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WritingEvalModule } from '../writing-eval/writing-eval.module';
import { AssessmentsController } from './assessments.controller';
import { ASSESSMENT_RANDOM, AssessmentsService } from './assessments.service';

@Module({
  imports: [
    PrismaModule,
    CurriculumModule,
    MasteryModule,
    GradingModule,
    WritingEvalModule,
  ],
  controllers: [AssessmentsController],
  providers: [
    AssessmentsService,
    { provide: ASSESSMENT_RANDOM, useValue: Math.random },
  ],
})
export class AssessmentsModule {}
