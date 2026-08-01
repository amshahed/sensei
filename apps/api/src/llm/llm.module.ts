import { Module } from '@nestjs/common';
import { GeminiLlmClient } from './gemini-llm-client';
import { LLM_CLIENT } from './llm-client';

/**
 * Binds the LlmClient token to the Gemini implementation for runtime grading
 * (L.4.a). Authoring (draft / critique) uses AnthropicLlmClient directly via
 * the CLI scripts — it does not go through this module.
 */
@Module({
  providers: [{ provide: LLM_CLIENT, useClass: GeminiLlmClient }],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
