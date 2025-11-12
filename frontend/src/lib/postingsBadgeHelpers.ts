// Color mapping for company sizes
export const COMPANY_SIZE_COLORS: Record<string, string> = {
  Startup: "#3B82F6", // Blue
  Medium: "#10B981", // Green
  Large: "#F59E0B", // Amber
  Enterprise: "#8B5CF6", // Purple
};

// Color mapping for industries
export const INDUSTRY_COLORS: Record<string, string> = {
  technology:
    "linear-gradient(90deg,rgba(42, 123, 155, 1) 0%, rgba(87, 136, 199, 1) 50%, rgba(3, 52, 105, 1) 100%)",
  healthcare: "#EF4444",
  finance: "oklch(62.7% 0.194 149.214)",
  "financial-services": "#FB923C",
  "financial-trading": "#FBBF24",
  "financial-technology":
    "linear-gradient(0deg,rgba(34, 193, 195, 1) 0%, rgba(253, 187, 45, 1) 100%);",
  fintech: "#57E66F",
  "database-technology": "oklch(37.4% 0.01 67.558)",
  defense: "#7C3AED",
  "defense-technology": "#7C3AED",
  aerospace: "#06B6D4",
  "aerospace-and-defense": "#0891B2",
  "Aerospace & Defense": "#0891B2",
  "aerospace/defense": "#0891B2",
  "automotive-technology": "#111112",
  "defense/aerospace": "#0891B2",
  "Defense/Aerospace": "#0891B2",
  "Defense & Space Systems": "#0891B2",
  "social-media": "#EC4899",
  "e-commerce": "#14B8A6",
  "E-commerce": "#14B8A6",
  "e-commerce/social media": "#14B8A6",
  "E-commerce/Technology": "#14B8A6",
  transportation: "#84CC16",
  Transportation: "#84CC16",
  "Transportation/Technology": "#84CC16",
  "Transportation/Tech": "#84CC16",
  "transportation-technology": "#84CC16",
  "Transportation and Logistics": "#A3E635",
  "technology and logistics": "#A3E635",
  logistics: "#BEF264",
  "Logistics/Delivery": "#BEF264",
  "logistics/robotics": "#BEF264",
  telecommunications: "#06B6D4",
  communications: "#06B6D4",
  "communications technology": "#06B6D4",
  "video conferencing/communications": "#06B6D4",
  cybersecurity: "#DC2626",
  Cybersecurity: "#DC2626",
  "cyber security consulting": "#B91C1C",
  consulting: "#92400E",
  "professional-services": "#A16207",
  "technology-consulting": "#A16207",
  "technology-services": "#B45309",
  "it-services": "#D97706",
  "managed-services": "#F59E0B",
  "marketing-technology":
    "linear-gradient(90deg,rgba(27, 99, 0, 0.94) 0%, rgba(73, 199, 0, 0.95) 50%, rgba(27, 99, 0, 0.94) 100%)",
  insurance: "#DC2626",
  Insurance: "#DC2626",
  "media/entertainment": "#7C3AED",
  "Media/Entertainment": "#7C3AED",
  "media and entertainment": "#7C3AED",
  "entertainment and media": "#7C3AED",
  "media-technology": "#8B5CF6",
  "media/software": "#8B5CF6",
  banking: "#1E40AF",
  Banking: "#1E40AF",
  "Banking/Financial Services": "#1E40AF",
  Healthcare: "#DC2626",
  edtech: "#3B82F6",
  "education technology": "#3B82F6",
  manufacturing: "#78716C",
  "manufacturing/technology": "#92400E",
  "consumer electronics": "#64748B",
  "Consumer Electronics": "#64748B",
  "consumer electronics, augmented and virtual reality": "#64748B",
  semiconductor: "#475569",
  SaaS: "#3B82F6",
  "SaaS/Process Mining": "#60A5FA",
  saas: "#3B82F6",
  "saas process mining": "#60A5FA",
  "enterprise-software": "#2563EB",
  software: "#3B82F6",
  "software-development": "#1E40AF",
  "software development tools": "#1E40AF",
  gaming: "#A855F7",
  "real estate technology": "#06B6D4",
  cryptocurrency: "#F59E0B",
  "ai/audio": "#6e55d3",
  "cryptocurrency/fintech": "#FBBF24",
  "Blockchain/DeFi": "#F59E0B",
  "advertising-technology": "#F97316",
  "Advertising/Technology": "#F97316",
  advertising: "#FB923C",
  Advertising: "#FB923C",
  "Art and Luxury": "#DC2626",
  "retail-technology": "#14B8A6",
  iot: "#06B6D4",
  "crm and ai": "#6366F1",
  tech: "#3B82F6",
  "gis software": "#10B981",
  "workforce-management": "#8B5CF6",
  "hr-technology": "#8B5CF6",
  "food-service": "#D97706",
  Restaurant: "#D97706",
  "consumer-goods": "#EF4444",
  Automotive: "#475569",
  automotive: "#475569",
  "national-security": "#7C3AED",
  "nuclear-energy": "#FBBF24",
  "information-technology": "#3B82F6",
  "algorithmic-trading": "#FBBF24",
};

/**
 * Get the badge color for a company size
 */
export function getCompanySizeBadgeColor(size: string | null): string {
  if (!size) return "#9CA3AF"; // Gray fallback
  return COMPANY_SIZE_COLORS[size] || "#9CA3AF";
}

/**
 * Get the badge color for an industry
 */
export function getIndustryBadgeColor(industry: string): string {
  const normIndustry = industry.toLowerCase().split(" ");
  let hyphName = "";
  normIndustry.forEach((np, i) => {
    if (i === 0) {
      hyphName += np;
    } else {
      hyphName += `-${np}`;
    }
  });
  return INDUSTRY_COLORS[hyphName] || "#9CA3AF"; // Gray fallback
}

/**
 * Get all unique company sizes from the data
 */
export function getAllCompanySizes(
  data: Array<{ company_size: string | null; industry: string }>
): string[] {
  const sizes = new Set<string>();
  data.forEach((item) => {
    if (item.company_size) {
      sizes.add(item.company_size);
    }
  });
  return Array.from(sizes).sort();
}

/**
 * Get all unique industries from the data
 */
export function getAllIndustries(
  data: Array<{ company_size: string | null; industry: string }>
): string[] {
  const industries = new Set<string>();
  data.forEach((item) => {
    industries.add(item.industry);
  });
  return Array.from(industries).sort();
}

/**
 * Create a badge component config
 */
export interface BadgeConfig {
  label: string;
  color: string;
  type: "size" | "industry";
}

export function createBadgeConfig(
  label: string,
  type: "size" | "industry"
): BadgeConfig {
  const color =
    type === "size"
      ? getCompanySizeBadgeColor(label)
      : getIndustryBadgeColor(label);

  return {
    label,
    color,
    type,
  };
}

/**
 * Helper to get inline style for a meta-pill
 */
export function getMetaPillStyle(
  value: string | null | undefined,
  type: "size" | "industry"
): React.CSSProperties {
  if (!value) return {};

  const color =
    type === "size"
      ? getCompanySizeBadgeColor(value)
      : getIndustryBadgeColor(value);

  return {
    backgroundColor: color,
    color: "#FFFFFF",
  };
}
