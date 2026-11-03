import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configModuleOptions } from './config/config-options';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { LessonsModule } from './lessons/lessons.module';
import { ChecksModule } from './checks/checks.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ProgressModule } from './progress/progress.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { UsersModule } from './users/users.module';
import { VoyageModule } from './voyage/voyage.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions()),
    AuthModule,
    PrismaModule,
    HealthModule,
    LessonsModule,
    ChecksModule,
    ReviewsModule,
    ProgressModule,
    CurriculumModule,
    AssessmentsModule,
    UsersModule,
    VoyageModule,
  ],
})
export class AppModule {}
