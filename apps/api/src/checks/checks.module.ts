import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { GradingModule } from '../grading/grading.module';
import { ChecksController } from './checks.controller';
import { ChecksService } from './checks.service';

@Module({
  imports: [MasteryModule, GradingModule],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
