import { Injectable } from '@nestjs/common';
import type {
  ReminderSettingsDto,
  ReminderSettingsRequest,
  RemindersDto,
} from '@sensei/types';
import { MasteryService, REVIEW_SESSION_CAP } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  DEFAULT_TARGET_MINUTES,
  isValidTimeZone,
  localDate,
} from '../streak/streak-rules';
import {
  buildPlan,
  DEFAULT_REMINDER_SETTINGS,
  PLAN_DAYS,
  zonedInstant,
} from './reminder-rules';

const USER_SELECT = {
  timezone: true,
  dailyTargetMinutes: true,
  remindersOn: true,
  reminderMinute: true,
  eveningReminder: true,
  quietStartMinute: true,
  quietEndMinute: true,
  remindersAskedAt: true,
} as const;

/**
 * Reminders (K.3.d/K.3.g). The server builds the plan; the phone schedules it
 * as local notifications and rebuilds it on open and after activity, so a
 * done day's reminders are cancelled as soon as it is done.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /**
   * Settings, the one-time offer, and the next days' reminders. `timeZone`
   * is the device's: it decides when that device's notifications fire.
   */
  async get(
    userId: string,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<RemindersDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    const settings: ReminderSettingsDto = user
      ? {
          on: user.remindersOn,
          minute: user.reminderMinute,
          evening: user.eveningReminder,
          quietStartMinute: user.quietStartMinute,
          quietEndMinute: user.quietEndMinute,
        }
      : DEFAULT_REMINDER_SETTINGS;
    // Offered once, in context: after the first completed lesson.
    const offer =
      !!user &&
      !user.remindersOn &&
      !user.remindersAskedAt &&
      (await this.prisma.lessonCompletion.findFirst({
        where: { userId },
        select: { lessonId: true },
      })) !== null;
    if (!settings.on) return { settings, offer, plan: [] };

    const tz =
      timeZone && isValidTimeZone(timeZone)
        ? timeZone
        : (user?.timezone ?? null);
    const today = localDate(now, tz);
    const day = await this.prisma.studyDay.findUnique({
      where: { userId_localDate: { userId, localDate: today } },
      select: { done: true, reviewsAnswered: true },
    });
    const dueTimes = await this.mastery.dueTimes(
      userId,
      zonedInstant(addDays(today, PLAN_DAYS), 0, tz),
      REVIEW_SESSION_CAP,
    );
    return {
      settings,
      offer,
      plan: buildPlan({
        settings,
        timeZone: tz,
        now,
        today,
        todayDone: day?.done ?? false,
        reviewsAnsweredToday: day?.reviewsAnswered ?? 0,
        sessionCap: REVIEW_SESSION_CAP,
        targetMinutes: user?.dailyTargetMinutes ?? DEFAULT_TARGET_MINUTES,
        dueTimes,
      }),
    };
  }

  /** Change any settings (this also answers the offer). */
  async update(
    userId: string,
    req: ReminderSettingsRequest,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<RemindersDto> {
    const data = {
      ...(req.on !== undefined && { remindersOn: req.on }),
      ...(req.minute !== undefined && { reminderMinute: req.minute }),
      ...(req.evening !== undefined && { eveningReminder: req.evening }),
      ...(req.quietStartMinute !== undefined && {
        quietStartMinute: req.quietStartMinute,
      }),
      ...(req.quietEndMinute !== undefined && {
        quietEndMinute: req.quietEndMinute,
      }),
      remindersAskedAt: now,
    };
    await this.prisma.user.upsert({
      where: { id: userId },
      update: data,
      create: { id: userId, ...data },
    });
    return this.get(userId, timeZone, now);
  }

  /** "Not now" on the offer: it isn't made again (reminders stay reachable on Home). */
  async dismissOffer(
    userId: string,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<RemindersDto> {
    await this.prisma.user.updateMany({
      where: { id: userId, remindersAskedAt: null },
      data: { remindersAskedAt: now },
    });
    return this.get(userId, timeZone, now);
  }
}
