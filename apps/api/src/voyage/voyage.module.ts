import { Module } from '@nestjs/common';
import { VoyageClient } from './voyage-client';

@Module({
  providers: [VoyageClient],
  exports: [VoyageClient],
})
export class VoyageModule {}
