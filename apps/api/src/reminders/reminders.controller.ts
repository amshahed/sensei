import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { ReminderSettingsRequest, RemindersDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { isMinuteOfDay } from './reminder-rules';
import { RemindersService } from './reminders.service';

const BOOLEAN_KEYS = ['on', 'evening'] as const;
const MINUTE_KEYS = ['minute', 'quietStartMinute', 'quietEndMinute'] as const;
const KEYS: readonly string[] = [...BOOLEAN_KEYS, ...MINUTE_KEYS];

/** A non-empty subset of the settings, each well-typed; unknown keys rejected. */
export function isReminderSettingsRequest(
  body: unknown,
): body is ReminderSettingsRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  const keys = Object.keys(b);
  return (
    keys.length > 0 &&
    keys.every((k) => KEYS.includes(k)) &&
    BOOLEAN_KEYS.every(
      (k) => b[k] === undefined || typeof b[k] === 'boolean',
    ) &&
    MINUTE_KEYS.every((k) => b[k] === undefined || isMinuteOfDay(b[k]))
  );
}

/** Reminders (K.3.d/K.3.g). `tz` = the device's IANA timezone. */
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  get(
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<RemindersDto> {
    return this.reminders.get(userId, tz);
  }

  @Put()
  update(
    @Body() body: unknown,
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<RemindersDto> {
    if (!isReminderSettingsRequest(body)) {
      throw new BadRequestException(
        'Body must set one or more of { "on": boolean, "evening": boolean, "minute" | "quietStartMinute" | "quietEndMinute": whole minutes 0–1439 }.',
      );
    }
    return this.reminders.update(userId, body, tz);
  }

  /** "Not now" on the one-time offer. */
  @Post('offer/dismiss')
  dismissOffer(
    @CurrentUserId() userId: string,
    @Query('tz') tz?: string,
  ): Promise<RemindersDto> {
    return this.reminders.dismissOffer(userId, tz);
  }
}
