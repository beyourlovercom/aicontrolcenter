export type KnownProvider = 'CLAUDE_CODE' | 'CODEX';

export type ProviderDecision = {
  provider: KnownProvider;
  displayLabel: string;
  routingReason: string | null;
};

const PROVIDER_LABELS: Record<KnownProvider, string> = {
  CLAUDE_CODE: 'Claude Code',
  CODEX: 'Codex',
};

const KNOWN_PROVIDERS = new Set<string>(['CLAUDE_CODE', 'CODEX']);

function isKnownProvider(value: unknown): value is KnownProvider {
  return typeof value === 'string' && KNOWN_PROVIDERS.has(value);
}

export function resolveProviderDecision(
  decision: Record<string, unknown> | null | undefined
): ProviderDecision | null {
  if (!decision) return null;
  const provider = decision['provider'];
  if (!isKnownProvider(provider)) return null;
  const rawRoutingReason = typeof decision['providerRoutingReason'] === 'string'
    ? decision['providerRoutingReason'].trim()
    : '';
  const routingReason = rawRoutingReason || null;
  return { provider, displayLabel: PROVIDER_LABELS[provider], routingReason };
}

export function providerDisplayLabel(provider: KnownProvider): string {
  return PROVIDER_LABELS[provider];
}
