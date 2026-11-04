import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { PlacementController } from './placement.controller';
import { PLACEMENT_RANDOM, PlacementService } from './placement.service';

@Module({
  imports: [MasteryModule],
  controllers: [PlacementController],
  providers: [
    PlacementService,
    { provide: PLACEMENT_RANDOM, useValue: Math.random },
  ],
})
export class PlacementModule {}
