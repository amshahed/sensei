import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';
import type {
  PlacementAnswerDto,
  PlacementAnswerRequest,
  PlacementResultDto,
  PlacementStartDto,
} from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { PlacementService } from './placement.service';

export function isAnswerRequest(body: unknown): body is PlacementAnswerRequest {
  if (!body || typeof body !== 'object') return false;
  const { itemId, choices } = body as Record<string, unknown>;
  return (
    typeof itemId === 'string' &&
    (choices === null ||
      (Array.isArray(choices) && choices.every((c) => typeof c === 'string')))
  );
}

/** Signup placement quiz (I.3.d, I.4.f). */
@Controller('placement')
export class PlacementController {
  constructor(private readonly placement: PlacementService) {}

  /** Start (or resume) the quiz. */
  @Post()
  start(@CurrentUserId() userId: string): Promise<PlacementStartDto> {
    return this.placement.start(userId);
  }

  /** "Skip — start from the beginning" (before the first answer only). */
  @Post('skip')
  skip(@CurrentUserId() userId: string): Promise<PlacementResultDto> {
    return this.placement.skip(userId);
  }

  /** Answer the next question; `choices: null` = "I don't know". */
  @Post(':attemptId/answer')
  answer(
    @Param('attemptId') attemptId: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<PlacementAnswerDto> {
    if (!isAnswerRequest(body)) {
      throw new BadRequestException(
        'Body must be { "itemId": string, "choices": string[] | null }.',
      );
    }
    return this.placement.answer(userId, attemptId, body);
  }
}
