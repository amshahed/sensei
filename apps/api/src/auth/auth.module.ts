import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AgeGateService } from './age-gate.service';
import { AgeGuard } from './age.guard';
import { AuthGuard } from './auth.guard';

/**
 * Registers the global guards so every route is authenticated and age-gated
 * by default. Global registration keeps controllers from having to remember
 * `@UseGuards` on each handler.
 *
 * Order matters: Nest runs global guards in registration order, so
 * {@link AuthGuard} sets `req.userId` before {@link AgeGuard} reads it.
 * Opt out per route with `@Public()` (both) or `@AgeExempt()` (age only).
 */
@Module({
  providers: [
    AgeGateService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AgeGuard },
  ],
})
export class AuthModule {}
