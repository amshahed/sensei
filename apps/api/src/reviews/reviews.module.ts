import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { RecallModule } from '../recall/recall.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [MasteryModule, RecallModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
