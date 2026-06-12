import { Body, Controller, Param, Post } from '@nestjs/common';
import type { CheckAnswerRequest, CheckResultDto } from '@sensei/types';
import { ChecksService } from './checks.service';

@Controller('checks')
export class ChecksController {
  constructor(private readonly checks: ChecksService) {}

  /** Submit an answer for one Check; returns whether it was correct. */
  @Post(':id/answer')
  answer(
    @Param('id') id: string,
    @Body() body: CheckAnswerRequest,
  ): Promise<CheckResultDto> {
    return this.checks.grade(id, body.answer ?? '');
  }
}
