import { Module } from '@nestjs/common';
import { StreakModule } from '../streak/streak.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [StreakModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
