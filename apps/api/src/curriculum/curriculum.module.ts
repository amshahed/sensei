import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurriculumController],
  providers: [CurriculumService],
})
export class CurriculumModule {}
