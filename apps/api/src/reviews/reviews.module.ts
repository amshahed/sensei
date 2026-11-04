import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { RecallModule } from '../recall/recall.module';
import { StreakModule } from '../streak/streak.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [StreakModule, MasteryModule, RecallModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
