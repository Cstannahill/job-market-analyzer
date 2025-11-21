export const COMPANY_ICON_COLORS: Record<string, string> = {
  godaddy: "#292929",
  mews: "#2B2828",
  rubrik: "#262930",
  chime: "#1dc879",
  ensono: "#6758ab",
  attlasian: "#1f6ddc",
  robinhood: "#c6f600",
  spotify: "#1f1b1a",
};
const NAME_MAP: Record<string, string> = {
  andurilindustries: "Anduril Industries",
  appliedintuition: "Applied Intuition",
  abnormalsecurity: "Abnormal Security",
  aurorainnovation: "Aurora Innovation",
  shieldai: "Shield-AI",
  ciandt: "CI&T",
};
export function getCompanyIconColor(company: string): string {
  const normCompany = company.toLowerCase().split(" ");
  let hyphName = "";
  normCompany.forEach((np, i) => {
    if (i === 0) {
      hyphName += np;
    } else {
      hyphName += `-${np}`;
    }
  });
  return COMPANY_ICON_COLORS[hyphName] || "#ffffff";
}

export const formatCompanyName = (name: string) => {
  name = name.toLowerCase();
  if (name.toLowerCase().includes("brillio")) {
    return "Brillio";
  }
  return NAME_MAP[name] || name;
};
