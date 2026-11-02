import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

/**
 * Registers {@link AuthGuard} as a global guard so every route is authenticated
 * by default; opt out per-route with `@Public()`. Global registration keeps
 * controllers from having to remember `@UseGuards` on each handler.
 */
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
