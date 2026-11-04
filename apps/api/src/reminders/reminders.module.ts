import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { StreakModule } from '../streak/streak.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MasteryModule, StreakModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
