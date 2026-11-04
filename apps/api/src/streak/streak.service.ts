import { Injectable, Logger } from '@nestjs/common';
import type { StudyDay } from '@prisma/client';
import type { DailyTargetMinutes, StreakDto } from '@sensei/types';
import { MasteryService, REVIEW_SESSION_CAP } from '../mastery/mastery.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
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
    const user = await this.loadUser(userId);
    const target = (user?.dailyTargetMinutes ??
      DEFAULT_TARGET_MINUTES) as DailyTargetMinutes;
    const today = localDate(
      now,
      user
        ? await this.rememberTimeZone(userId, user.timezone, timeZone)
        : (timeZone ?? null),
    );
    const bank = await this.applyFreezes(
      userId,
      today,
      user?.streakFreezes ?? 0,
    );

    const rows = await this.prisma.studyDay.findMany({
      where: { userId },
      orderBy: { localDate: 'desc' },
      take: STREAK_LOOKBACK_DAYS,
    });
    const todayRow = rows.find((r) => r.localDate === today);
    let reviewsRemaining = todayRow?.done
      ? 0
      : await this.reviewsRemaining(
          userId,
          todayRow?.reviewsAnswered ?? 0,
          now,
        );
    // Settle here too: a lowered target can finish a day (or earn its freeze)
    // with no new activity.
    let freezes = bank;
    if (todayRow) {
      const settled = await this.settleDay(
        userId,
        todayRow,
        target,
        now,
        reviewsRemaining,
      );
      if (settled.done) reviewsRemaining = 0;
      todayRow.done = settled.done;
      if (settled.freezeBanked) freezes++;
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

  /**
   * The timezone the learner's days are counted in (K.3.f): the app's
   * reported zone, stored when valid and changed, else the stored one (UTC
   * until known). Shared with reminders so both read the same calendar day.
   */
  async rememberTimeZone(
    userId: string,
    stored: string | null,
    reported?: string,
  ): Promise<string | null> {
    if (reported && reported !== stored && isValidTimeZone(reported)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { timezone: reported },
      });
      return reported;
    }
    return stored;
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
    // Activity on the day back from a gap fills the gap first (K.3.a): once
    // today is done it becomes the last covered day, and a gap behind a
    // covered day is never looked at again.
    await this.applyFreezes(userId, today, user.streakFreezes);
    const effort =
      activity.kind === 'lesson'
        ? (activity.estimatedMinutes ?? DEFAULT_LESSON_MINUTES) * 60
        : activity.count * ANSWER_EFFORT_SECONDS;
    const reviews =
      activity.kind === 'answers' && activity.review ? activity.count : 0;

    const args = {
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
    };
    let day: StudyDay;
    try {
      day = await this.prisma.studyDay.upsert(args);
    } catch (err) {
      // Two first credits of the day raced: both missed the row and one
      // create lost on the primary key. The row exists now — retry updates it.
      if (!isUniqueViolation(err)) throw err;
      day = await this.prisma.studyDay.upsert(args);
    }

    await this.settleDay(
      userId,
      day,
      user.dailyTargetMinutes ?? DEFAULT_TARGET_MINUTES,
      now,
    );
  }

  /**
   * Mark the day done once due reviews are cleared and effort meets the
   * target, and bank a freeze when a done day reaches 2× target (K.3.a —
   * once per day, capped). Both writes are compare-and-set, so concurrent
   * settles agree. `reviewsRemaining` may be passed when already known.
   */
  private async settleDay(
    userId: string,
    day: StudyDay,
    targetMinutes: number,
    now: Date,
    reviewsRemaining?: number,
  ): Promise<{ done: boolean; freezeBanked: boolean }> {
    const target = targetMinutes * 60;
    let done = day.done;
    if (!done && day.effortSeconds >= target) {
      const remaining =
        reviewsRemaining ??
        (await this.reviewsRemaining(userId, day.reviewsAnswered, now));
      if (remaining === 0) {
        await this.prisma.studyDay.updateMany({
          where: { userId, localDate: day.localDate, done: false },
          data: { done: true, doneAt: now },
        });
        done = true;
      }
    }
    let freezeBanked = false;
    if (
      done &&
      !day.freezeEarned &&
      day.effortSeconds >= FREEZE_EARN_MULTIPLE * target
    ) {
      const { count } = await this.prisma.studyDay.updateMany({
        where: { userId, localDate: day.localDate, freezeEarned: false },
        data: { freezeEarned: true },
      });
      if (count === 1) {
        const banked = await this.prisma.user.updateMany({
          where: { id: userId, streakFreezes: { lt: FREEZE_CAP } },
          data: { streakFreezes: { increment: 1 } },
        });
        freezeBanked = banked.count === 1;
      }
    }
    return { done, freezeBanked };
  }

  /**
   * Cover days missed since the last covered one with banked freezes — only
   * when the bank covers the whole gap (otherwise the streak is already lost
   * and the bank is kept). A cheap unlocked look decides whether there is
   * anything to do; the spend itself is serialised per learner with a row
   * lock so concurrent calls can't spend the same freezes twice. Returns the
   * bank left.
   */
  private async applyFreezes(
    userId: string,
    today: string,
    bank: number,
  ): Promise<number> {
    if (bank === 0) return 0;
    const gap = missedDays(await this.recentDays(userId, today), today).length;
    if (gap === 0 || gap > bank) return bank;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { streakFreezes: true },
      });
      // Re-read under the lock: another call may have spent or filled first.
      const locked = user?.streakFreezes ?? 0;
      if (locked === 0) return 0;
      const missed = missedDays(
        await this.recentDays(userId, today, tx),
        today,
      );
      if (missed.length === 0 || missed.length > locked) return locked;
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
      return locked - missed.length;
    });
  }

  /**
   * The last cap+1 days with activity before today. Enough for the gap: if
   * none of them is covered, at least cap+1 days were missed, which no bank
   * can cover.
   */
  private recentDays(
    userId: string,
    today: string,
    db: Pick<PrismaService, 'studyDay'> = this.prisma,
  ) {
    return db.studyDay.findMany({
      where: { userId, localDate: { lt: today } },
      orderBy: { localDate: 'desc' },
      take: FREEZE_CAP + 1,
    });
  }

  /** Due reviews still standing between the learner and a done day. */
  private async reviewsRemaining(
    userId: string,
    answeredToday: number,
    now: Date,
  ): Promise<number> {
    const left = REVIEW_SESSION_CAP - answeredToday;
    if (left <= 0) return 0;
    return this.mastery.dueCount(userId, now, left);
  }
}

function quietUntil(dismissedAt: Date | null): Date | null {
  return dismissedAt
    ? new Date(dismissedAt.getTime() + SUGGEST_COOLDOWN_DAYS * DAY_MS)
    : null;
}
