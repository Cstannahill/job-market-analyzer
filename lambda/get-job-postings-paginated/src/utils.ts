export function slugifyTech(raw: string): string {
  const structural = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t === "c#") return "csharp";
    if (t === "c++") return "cpp";
    if (t === ".net") return "dotnet";
    if (t.endsWith(".js")) {
      const base = t.slice(0, -3);
      if (["node", "next", "nuxt", "express"].includes(base))
        return base + "js";
    }
    if (t === "postgres" || t === "postgresql") return "postgresql";
    if (t === "mongo" || t === "mongodb") return "mongodb";
    return t;
  };
  const nfd = structural(raw)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return nfd
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
