import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { StreakDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { DAILY_TARGETS, isDailyTarget } from './streak-rules';
import { StreakService } from './streak.service';

/** Learning streak (K.2/K.3.f). `tz` = the app's IANA timezone. */
@Controller('streak')
export class StreakController {
  constructor(private readonly streak: StreakService) {}

  @Get()
  status(
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<StreakDto> {
    return this.streak.status(userId, tz);
  }

  /** Change the daily target — an accepted suggestion or a manual edit (K.3.c). */
  @Put('target')
  setTarget(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<StreakDto> {
    const minutes = (body as { minutes?: unknown } | null)?.minutes;
    if (!isDailyTarget(minutes)) {
      throw new BadRequestException(
        `Body must be { "minutes": ${DAILY_TARGETS.join(' | ')} }.`,
      );
    }
    return this.streak.setTarget(userId, minutes, tz);
  }

  /** "Not now" on a target suggestion. */
  @Post('suggestion/dismiss')
  dismiss(
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<StreakDto> {
    return this.streak.dismissSuggestion(userId, tz);
  }
}
