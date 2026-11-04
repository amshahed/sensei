import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { StreakController } from './streak.controller';
import { StreakService } from './streak.service';

@Module({
  imports: [MasteryModule],
  controllers: [StreakController],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
