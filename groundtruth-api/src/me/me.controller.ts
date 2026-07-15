import { Controller, Get, Req } from '@nestjs/common';
import { MeService } from './me.service';
import type { AuthedRequest } from '@/auth/auth.guard';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Tras login (Supabase Auth), el frontend llama aquí para armar la sesión. */
  @Get()
  getMe(@Req() req: AuthedRequest) {
    return this.me.getProfile(req.authUserId);
  }
}
