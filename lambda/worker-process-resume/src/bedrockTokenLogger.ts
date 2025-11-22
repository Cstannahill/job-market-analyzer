import {
  BedrockRuntimeClient,
  CountTokensCommand,
  type BedrockRuntimeClientConfig,
  type Message as BrMessage,
  type SystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";

let clientCache: Record<string, BedrockRuntimeClient> = {};
function getClient(region?: string): BedrockRuntimeClient {
  const r = region || DEFAULT_REGION;
  if (!clientCache[r]) {
    const cfg: BedrockRuntimeClientConfig = { region: r };
    clientCache[r] = new BedrockRuntimeClient(cfg);
  }
  return clientCache[r];
}

type UserOrAssistant = "user" | "assistant";
export type TextBlock = { text: string };
export type ConverseMessage = {
  role: UserOrAssistant;
  content: TextBlock[];
};

type ROTextBlock = Readonly<{ text: string }>;
type ROConverseMessage = Readonly<{
  role: UserOrAssistant;
  content: ReadonlyArray<ROTextBlock>;
}>;

export interface CountConverseParams {
  modelId: string;
  messages: ReadonlyArray<ROConverseMessage>;
  system?: ReadonlyArray<ROTextBlock>;
  region?: string;
}

/** Count input tokens for a Converse-style request (matches Bedrock billing). */
export async function countConverseTokens(
  p: CountConverseParams
): Promise<number> {
  const br = getClient(p.region);

  const messages: BrMessage[] = p.messages.map((m) => ({
    role: m.role,
    content: m.content.map((c) => ({ text: c.text })),
  }));

  const system: SystemContentBlock[] | undefined = p.system
    ? p.system.map((s) => ({ text: s.text }))
    : undefined;

  const cmd = new CountTokensCommand({
    modelId: p.modelId,
    input: {
      converse: {
        messages,
        ...(system ? { system } : {}),
      },
    },
  });

  const out = await br.send(cmd);
  return out.inputTokens ?? 0;
}

/** Optional: preflight logger so you can see the count before sending Converse. */
export async function preflightLog(opts: {
  modelId: string;
  region?: string;
  messages: ReadonlyArray<ROConverseMessage>;
  system?: ReadonlyArray<ROTextBlock>;
  tag?: string;
}) {
  const inputTokens = await countConverseTokens({
    modelId: opts.modelId,
    region: opts.region,
    messages: opts.messages,
    system: opts.system,
  });

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        event: "bedrock.preflight.countTokens",
        tag: opts.tag,
        modelId: opts.modelId,
        region: opts.region || DEFAULT_REGION,
        inputTokens,
      },
      null,
      2
    )
  );
  return inputTokens;
}

export function userMessage(text: string): ROConverseMessage {
  return { role: "user", content: [{ text }] };
}
