import { Module } from '@nestjs/common';
import { StreakModule } from '../streak/streak.module';
import { LessonsController } from './lessons.controller';
import { LESSON_RANDOM, LessonsService } from './lessons.service';

@Module({
  imports: [StreakModule],
  controllers: [LessonsController],
  providers: [
    LessonsService,
    { provide: LESSON_RANDOM, useValue: Math.random },
  ],
})
export class LessonsModule {}
