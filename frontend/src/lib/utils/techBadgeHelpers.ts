const moduleLoaders = import.meta.glob("/src/assets/icons/*.{svg,SVG}", {
  eager: false,
  import: "default",
}) as Record<string, () => Promise<string>>;

export function normalizeLookup(name: string) {
  const lower = name.toLowerCase();

  const specialCases: Record<string, string> = {
    rails: "rails",
    "ruby on rails": "rails",
    aws: "aws",
    "c/c++": "cpp",
    "c++": "cpp",
    "c ++": "cpp",
    "c + +": "cpp",
    cplusplus: "cpp",
    cpp: "cpp",
    "c plus plus": "cpp",
    "app engine": "appengine",
    "vue.js": "vue",
    ".net core": "dot-net-core",
    "vercel platform": "vercel",
    "redux toolkit": "redux",
    "asp.net": "asp",
    "aws lambda": "lambda",
    "aws-lambda": "lambda",
    "api gateway": "api-gateway",
    "event bridge": "eventbridge",
    "event-bridge": "eventbridge",
    ec2: "ec2",
    "aws ec2": "ec2",
    "aws ecs": "ecs",
    "aws iam": "iam",
    s3: "s3",
    "aws s3": "s3",
    "vanilla js": "javascript",
    "modern javascript": "javascript",
    "modern js": "javascript",
    llms: "llm",
    "ai/llm": "llm",
    "ai/ml": "llm",
    "dagger 2": "android",
    "jetpack navigation": "android",
    "ios sdk": "ios",
    "ios sdks": "ios",
    wasm: "webassembly",
    "ci/cd": "ci-cd",
    apis: "api",
    "rest api": "rest",
    "restful api": "rest",
  };

  if (specialCases[lower]) return specialCases[lower];

  if (
    (lower.includes("continuous") && lower.includes("integration")) ||
    (lower.includes("continuous") && lower.includes("delivery"))
  )
    return "ci-cd";
  if (lower.includes("rest") && lower.includes("api")) return "rest";
  if (lower.includes("bedrock")) return "bedrock";
  if (lower.includes("flink")) return "flink";
  if (lower.includes("airflow")) return "airflow";
  if (lower.includes("maven")) return "maven";
  if (lower.includes("agile")) return "agile";
  if (lower.includes("llms") || lower === "ai" || lower === "ai models")
    return "llm";
  if (lower.includes("dynamo")) return "dynamodb";
  if (lower.includes("atlassian")) return "atlassian";
  if (lower.includes("apache spark") || lower.includes("apache-spark"))
    return "spark";
  if (lower.includes("linux")) return "linux";
  if (lower.includes("kafka")) return "kafka";
  if (lower.includes("new") && lower.includes("relic")) return "new-relic";
  if (
    lower.includes("cloudwatch") ||
    (lower.includes("cloud") && lower.includes("watch"))
  )
    return "cloudwatch";
  if (
    (lower.includes(".net") ||
      (lower.includes("dot") && lower.includes("net"))) &&
    lower.includes("core")
  )
    return "dot-net-core";
  if (lower.includes("gitlab")) return "gitlab";
  if (lower.includes("kotlin")) return "kotlin";
  if (lower === "cloudflare" || lower.includes("cloudflare"))
    return "cloudflare";
  if (lower.includes("next.js") || lower.includes("nextjs")) return "next";
  if (lower.includes("html")) return "html5";
  if (lower.includes("css")) return "css3";
  if (lower.includes("node") || lower.includes("node.js")) return "node";
  if (lower === "database" || lower === "databases")
    return "database-management-systems";
  if (lower.includes("java") && !lower.includes("javascript")) return "java";
  if (lower.includes("android")) return "android";
  if (lower.includes("cloud platform")) return "cloud";
  if (lower.includes("react")) return "react";
  if (lower.includes("google cloud")) return "gcp";
  if (
    lower === "go" ||
    lower === "golang" ||
    lower.includes("golang") ||
    lower.includes("go lang")
  )
    return "golang";
  if (lower.includes("java/")) return "java";
  if (lower.includes("postgre")) return "postgresql";
  if (lower.includes("rag") && lower.includes("pipeline")) return "rag";
  if (lower === "rags") return "rag";
  if (lower.includes("rest") && lower.includes("api")) return "rest";
  if (lower === "rest") return "rest";
  if (lower.includes("web services")) return "aws";
  if (lower.includes("juniper")) return "juniper";
  if (lower.includes("spring") || lower === "springboot") return "spring";

  return name
    .toLowerCase()
    .replace(/^c#$/, "csharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const hasTechIcon = (name: string): boolean => {
  const key = normalizeLookup(name);
  const iconPath = `/src/assets/icons/${key}.svg`;
  return Boolean(moduleLoaders[iconPath]);
};
