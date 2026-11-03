import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';
import type {
  AssessmentResultDto,
  AssessmentStartDto,
  AssessmentSubmitRequest,
} from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AssessmentsService } from './assessments.service';

function isSubmitRequest(body: unknown): body is AssessmentSubmitRequest {
  if (!body || typeof body !== 'object') return false;
  const answers = (body as { answers?: unknown }).answers;
  return (
    Array.isArray(answers) &&
    answers.every(
      (a: unknown) =>
        !!a &&
        typeof a === 'object' &&
        typeof (a as { itemId?: unknown }).itemId === 'string' &&
        typeof (a as { answer?: unknown }).answer === 'string',
    )
  );
}

/** Chapter Assessment — skip-test or exit (I.4.d.a). */
@Controller()
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  /** Start an attempt: ~20 sampled questions, answers kept server-side. */
  @Post('chapters/:chapterId/assessment')
  start(
    @Param('chapterId') chapterId: string,
    @CurrentUserId() userId: string,
  ): Promise<AssessmentStartDto> {
    return this.assessments.start(userId, chapterId);
  }

  /** Submit every answer once; returns the score and corrections. */
  @Post('assessments/:attemptId/submit')
  submit(
    @Param('attemptId') attemptId: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<AssessmentResultDto> {
    if (!isSubmitRequest(body)) {
      throw new BadRequestException(
        'Body must be { "answers": [{ "itemId": string, "answer": string }] }.',
      );
    }
    return this.assessments.submit(userId, attemptId, body);
  }
}
