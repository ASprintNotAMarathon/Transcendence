import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe. Docker Compose (`condition: service_healthy`) and nginx
 * use this to tell whether the app itself is up, independent of anything
 * around it.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
