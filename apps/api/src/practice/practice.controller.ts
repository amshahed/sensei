import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import type {
  ItemType,
  PracticeAnswerRequest,
  PracticeResultDto,
  PracticeScopesDto,
  PracticeSessionDto,
  PracticeStartRequest,
} from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { PracticeService } from './practice.service';

const ITEM_TYPES: readonly ItemType[] = ['KANA', 'VOCAB', 'KANJI', 'GRAMMAR'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function isStartRequest(body: unknown): body is PracticeStartRequest {
  if (!isObject(body) || !isObject(body.scope)) return false;
  const { kind, id } = body.scope;
  const scopeOk =
    kind === 'weakest' ||
    ((kind === 'module' || kind === 'chapter') &&
      typeof id === 'string' &&
      id.length > 0);
  const types = body.types;
  const typesOk =
    types === undefined ||
    (Array.isArray(types) &&
      types.every((t) => ITEM_TYPES.includes(t as ItemType)));
  return scopeOk && typesOk;
}

export function isAnswerRequest(body: unknown): body is PracticeAnswerRequest {
  return (
    isObject(body) &&
    typeof body.itemId === 'string' &&
    typeof body.answer === 'string'
  );
}

/** Practice Mode (J.1): learner-directed drill over learned items. */
@Controller('practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  /** Drillable (learned) item counts per module / chapter / item type. */
  @Get('scopes')
  scopes(@CurrentUserId() userId: string): Promise<PracticeScopesDto> {
    return this.practice.scopes(userId);
  }

  /** Start a drill over a scope, weakest first. */
  @Post('sessions')
  start(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<PracticeSessionDto> {
    if (!isStartRequest(body)) {
      throw new BadRequestException(
        'Body must be { "scope": { "kind": "weakest" } | { "kind": "module" | "chapter", "id": string }, "types"?: ItemType[] }.',
      );
    }
    return this.practice.start(userId, {
      scope:
        body.scope.kind === 'weakest'
          ? { kind: 'weakest' }
          : { kind: body.scope.kind, id: body.scope.id },
      ...(body.types ? { types: body.types } : {}),
    });
  }

  /** Answer one item; only the session's first scored answer per item updates FSRS. */
  @Post('sessions/:sessionId/answer')
  answer(
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string,
  ): Promise<PracticeResultDto> {
    if (!isAnswerRequest(body)) {
      throw new BadRequestException(
        'Body must be { "itemId": string, "answer": string }.',
      );
    }
    return this.practice.answer(userId, sessionId, body);
  }
}
