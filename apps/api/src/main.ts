import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Mobile client is a separate origin. Restrict to CORS_ORIGIN (comma-separated)
  // when set; default to reflecting any origin for local dev convenience.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors(
    corsOrigin ? { origin: corsOrigin.split(',').map((o) => o.trim()) } : {},
  );
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`[api] listening on http://localhost:${port}`);
}
void bootstrap();
