import { Controller, Get } from '@nestjs/common';
import type { ProgressDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** Learner progress snapshot for the Dashboard (J.2). */
  @Get()
  getProgress(@CurrentUserId() userId: string): Promise<ProgressDto> {
    return this.progress.getProgress(userId);
  }
}
