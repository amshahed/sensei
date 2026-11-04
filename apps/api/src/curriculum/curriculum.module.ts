import { Module } from '@nestjs/common';
import { MasteryModule } from '../mastery/mastery.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [PrismaModule, MasteryModule],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
