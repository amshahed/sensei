import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { LessonsModule } from './lessons/lessons.module';
import { ChecksModule } from './checks/checks.module';
import { ReviewsModule } from './reviews/reviews.module';
import { VoyageModule } from './voyage/voyage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    LessonsModule,
    ChecksModule,
    ReviewsModule,
    VoyageModule,
  ],
})
export class AppModule {}
