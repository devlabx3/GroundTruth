import { Global, Module } from '@nestjs/common';
import { SolanaService } from './solana.service';

/** Global: la certificación (embarques) y la tesorería lo necesitan. */
@Global()
@Module({
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
