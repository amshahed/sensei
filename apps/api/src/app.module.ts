import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { LessonsModule } from './lessons/lessons.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    LessonsModule,
  ],
})
export class AppModule {}
