import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { MasteryModule } from '../mastery/mastery.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RecallModule } from '../recall/recall.module';
import { StreakModule } from '../streak/streak.module';
import { AssessmentsController } from './assessments.controller';
import { ASSESSMENT_RANDOM, AssessmentsService } from './assessments.service';

@Module({
  imports: [
    StreakModule,
    PrismaModule,
    CurriculumModule,
    MasteryModule,
    RecallModule,
  ],
  controllers: [AssessmentsController],
  providers: [
    AssessmentsService,
    { provide: ASSESSMENT_RANDOM, useValue: Math.random },
  ],
})
export class AssessmentsModule {}
