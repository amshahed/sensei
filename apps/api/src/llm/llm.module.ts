import { Module } from '@nestjs/common';
import { AnthropicLlmClient } from './anthropic-llm-client';
import { LLM_CLIENT } from './llm-client';

/**
 * Binds the LlmClient token to the Anthropic implementation. Swap the
 * `useClass` here to change providers; nothing downstream depends on Anthropic.
 */
@Module({
  providers: [{ provide: LLM_CLIENT, useClass: AnthropicLlmClient }],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
