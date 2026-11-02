import { Controller, Get } from '@nestjs/common';
import type { MeDto } from '@sensei/types';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Returns the authenticated user, creating the `users` row on first sign-in
   * (L.6). The client calls this once after auth to confirm the session and
   * materialise the account.
   */
  @Get()
  me(@CurrentUserId() userId: string): Promise<MeDto> {
    return this.users.ensureUser(userId);
  }
}
