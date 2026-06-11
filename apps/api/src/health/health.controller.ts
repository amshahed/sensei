import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@sensei/types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'sensei-api',
      timestamp: new Date().toISOString(),
    };
  }
}
