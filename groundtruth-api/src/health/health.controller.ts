import { Controller, Get } from '@nestjs/common';
import { Public } from '@/auth/public.decorator';
import { DbService } from '@/db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Public()
  @Get()
  async health() {
    await this.db.queryOne('select 1 as ok');
    return { status: 'ok' };
  }
}
