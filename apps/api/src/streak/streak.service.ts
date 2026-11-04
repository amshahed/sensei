import { Injectable, Logger } from '@nestjs/common';
import type { DailyTargetMinutes, StreakDto } from '@sensei/types';
import { MasteryService, REVIEW_SESSION_CAP } from '../mastery/mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ANSWER_EFFORT_SECONDS,
  DEFAULT_LESSON_MINUTES,
  DEFAULT_TARGET_MINUTES,
  FREEZE_CAP,
  FREEZE_EARN_MULTIPLE,
  isValidTimeZone,
  localDate,
  missedDays,
  streakLength,
  SUGGEST_COOLDOWN_DAYS,
  targetSuggestion,
} from './streak-rules';

/** Real work to credit toward today (K.3.f). */
export type StudyActivity =
  | { kind: 'lesson'; estimatedMinutes: number | null }
  | { kind: 'answers'; count: number; review?: boolean };

/** How far back the streak walk looks (a longer streak displays as this). */
const STREAK_LOOKBACK_DAYS = 400;
const DAY_MS = 86_400_000;

/**
 * The learning streak (K.2, K.3.a–c, K.3.f). Activity is credited as effort on
 * the learner's local day; a day is done once due reviews are cleared and
 * effort meets the target. Over-delivering banks capped freezes, which cover
 * missed days automatically. Target changes are only ever suggested.
 */
@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /**
   * Credit an activity to today and settle the day. Best-effort: the learning
   * action that called it has already succeeded and must not fail on this.
   */
  async record(
    userId: string,
    activity: StudyActivity,
    now: Date = new Date(),
  ): Promise<void> {
    try {
      await this.credit(userId, activity, now);
    } catch (err) {
      this.logger.error(`Streak credit failed for ${userId}: ${String(err)}`);
    }
  }

  /** Today's streak state. `timeZone` (from the app) is stored when it changes. */
  async status(
    userId: string,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<StreakDto> {
    let user = await this.loadUser(userId);
    if (
      user &&
      timeZone &&
      timeZone !== user.timezone &&
      isValidTimeZone(timeZone)
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { timezone: timeZone },
      });
      user = { ...user, timezone: timeZone };
    }
    const target = (user?.dailyTargetMinutes ??
      DEFAULT_TARGET_MINUTES) as DailyTargetMinutes;
    const today = localDate(now, user?.timezone ?? timeZone ?? null);
    // Only an actual bank can cover a gap: skip the locking transaction otherwise.
    const freezes =
      user && user.streakFreezes > 0
        ? await this.applyFreezes(userId, today)
        : (user?.streakFreezes ?? 0);

    const rows = await this.prisma.studyDay.findMany({
      where: { userId },
      orderBy: { localDate: 'desc' },
      take: STREAK_LOOKBACK_DAYS,
    });
    const todayRow = rows.find((r) => r.localDate === today);
    const reviewsRemaining = todayRow?.done
      ? 0
      : await this.reviewsRemaining(
          userId,
          todayRow?.reviewsAnswered ?? 0,
          now,
        );
    // Settle here too: a lowered target can complete a day with no new activity.
    if (
      todayRow &&
      !todayRow.done &&
      reviewsRemaining === 0 &&
      todayRow.effortSeconds >= target * 60
    ) {
      await this.prisma.studyDay.updateMany({
        where: { userId, localDate: today, done: false },
        data: { done: true, doneAt: now },
      });
      todayRow.done = true;
    }

    return {
      days: streakLength(rows, today),
      today: {
        done: todayRow?.done ?? false,
        effortMinutes: Math.floor((todayRow?.effortSeconds ?? 0) / 60),
        targetMinutes: target,
        reviewsRemaining,
      },
      freezes,
      freezeCap: FREEZE_CAP,
      suggestion: targetSuggestion(
        rows,
        today,
        target,
        quietUntil(user?.targetSuggestionDismissedAt ?? null),
        now,
      ),
    };
  }

  /**
   * Set the daily target (an accepted suggestion or a manual edit). Starts a
   * quiet period so the old window's data doesn't immediately re-suggest.
   */
  async setTarget(
    userId: string,
    minutes: DailyTargetMinutes,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<StreakDto> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { dailyTargetMinutes: minutes, targetSuggestionDismissedAt: now },
      create: {
        id: userId,
        dailyTargetMinutes: minutes,
        targetSuggestionDismissedAt: now,
      },
    });
    return this.status(userId, timeZone, now);
  }

  /** "Not now" on a suggestion: quiet for {@link SUGGEST_COOLDOWN_DAYS}. */
  async dismissSuggestion(
    userId: string,
    timeZone?: string,
    now: Date = new Date(),
  ): Promise<StreakDto> {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { targetSuggestionDismissedAt: now },
    });
    return this.status(userId, timeZone, now);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private loadUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        dailyTargetMinutes: true,
        streakFreezes: true,
        targetSuggestionDismissedAt: true,
      },
    });
  }

  private async credit(userId: string, activity: StudyActivity, now: Date) {
    const user = await this.loadUser(userId);
    if (!user) return;
    const today = localDate(now, user.timezone);
    const effort =
      activity.kind === 'lesson'
        ? (activity.estimatedMinutes ?? DEFAULT_LESSON_MINUTES) * 60
        : activity.count * ANSWER_EFFORT_SECONDS;
    const reviews =
      activity.kind === 'answers' && activity.review ? activity.count : 0;

    const day = await this.prisma.studyDay.upsert({
      where: { userId_localDate: { userId, localDate: today } },
      create: {
        userId,
        localDate: today,
        effortSeconds: effort,
        reviewsAnswered: reviews,
      },
      update: {
        effortSeconds: { increment: effort },
        reviewsAnswered: { increment: reviews },
      },
    });

    const target = (user.dailyTargetMinutes ?? DEFAULT_TARGET_MINUTES) * 60;
    let done = day.done;
    if (!done && day.effortSeconds >= target) {
      const cleared =
        day.reviewsAnswered >= REVIEW_SESSION_CAP ||
        (await this.mastery.getDue(userId, now)).length === 0;
      if (cleared) {
        await this.prisma.studyDay.updateMany({
          where: { userId, localDate: today, done: false },
          data: { done: true, doneAt: now },
        });
        done = true;
      }
    }
    // K.3.a: a done day at 2× target banks one freeze (once per day, capped).
    if (
      done &&
      !day.freezeEarned &&
      day.effortSeconds >= FREEZE_EARN_MULTIPLE * target
    ) {
      const { count } = await this.prisma.studyDay.updateMany({
        where: { userId, localDate: today, freezeEarned: false },
        data: { freezeEarned: true },
      });
      if (count === 1) {
        await this.prisma.user.updateMany({
          where: { id: userId, streakFreezes: { lt: FREEZE_CAP } },
          data: { streakFreezes: { increment: 1 } },
        });
      }
    }
  }

  /**
   * Cover days missed since the last covered one with banked freezes — only
   * when the bank covers the whole gap (otherwise the streak is already lost
   * and the bank is kept). Serialised per learner with a row lock so two
   * concurrent reads can't spend the same freezes twice. Returns the bank.
   */
  private async applyFreezes(userId: string, today: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { streakFreezes: true },
      });
      const bank = user?.streakFreezes ?? 0;
      if (bank === 0) return 0;
      // The last cap+1 days with activity suffice: if none of them is covered,
      // at least cap+1 days were missed, which no bank can cover.
      const recent = await tx.studyDay.findMany({
        where: { userId, localDate: { lt: today } },
        orderBy: { localDate: 'desc' },
        take: FREEZE_CAP + 1,
      });
      const missed = missedDays(recent, today);
      if (missed.length === 0 || missed.length > bank) return bank;
      for (const localDate of missed) {
        await tx.studyDay.upsert({
          where: { userId_localDate: { userId, localDate } },
          create: { userId, localDate, frozen: true },
          update: { frozen: true },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { streakFreezes: { decrement: missed.length } },
      });
      return bank - missed.length;
    });
  }

  /** Reviews still standing between the learner and a done day. */
  private async reviewsRemaining(
    userId: string,
    answeredToday: number,
    now: Date,
  ): Promise<number> {
    if (answeredToday >= REVIEW_SESSION_CAP) return 0;
    const due = (await this.mastery.getDue(userId, now)).length;
    return Math.min(due, REVIEW_SESSION_CAP - answeredToday);
  }
}

function quietUntil(dismissedAt: Date | null): Date | null {
  return dismissedAt
    ? new Date(dismissedAt.getTime() + SUGGEST_COOLDOWN_DAYS * DAY_MS)
    : null;
}
