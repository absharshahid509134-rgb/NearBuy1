import { GroundedRuleEngine, HostedLlmProvider, type LlmProvider } from '@nearbuy/ai'

export function createLlmProvider(kind: 'grounded' | 'llm', apiKey?: string, model?: string): LlmProvider {
  return kind === 'llm' && apiKey ? new HostedLlmProvider(apiKey, model) : new GroundedRuleEngine()
}

export type { LlmProvider }
