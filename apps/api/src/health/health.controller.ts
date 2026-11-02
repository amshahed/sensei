import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@sensei/types';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'sensei-api',
      timestamp: new Date().toISOString(),
    };
  }
}
