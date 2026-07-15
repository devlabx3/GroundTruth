import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { RateLimitGuard } from './rate-limit.guard';

/** Verificador público (V2): la única superficie sin autenticación. */
@Module({
  controllers: [PublicController],
  providers: [PublicService, RateLimitGuard],
})
export class PublicModule {}
