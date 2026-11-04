import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MasteryModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
