import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { ChecksController } from './checks.controller';
import { ChecksService } from './checks.service';

@Module({
  imports: [MasteryModule],
  controllers: [ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
