// Color mapping for company sizes
export const COMPANY_SIZE_COLORS: Record<string, string> = {
  Startup: "#3B82F6", // Blue
  Medium: "#10B981", // Green
  Large: "#F59E0B", // Amber
  Enterprise: "#8B5CF6", // Purple
};

// Color mapping for industries
export const INDUSTRY_COLORS: Record<string, string> = {
  Technology: "#6366F1",
  healthcare: "#EF4444",
  finance: "#F97316",
  "financial services": "#FB923C",
  "financial trading": "#FBBF24",
  fintech: "#FCDX34",
  defense: "#7C3AED",
  aerospace: "#06B6D4",
  "aerospace and defense": "#0891B2",
  "Aerospace & Defense": "#0891B2",
  "aerospace/defense": "#0891B2",
  "defense/aerospace": "#0891B2",
  "Defense/Aerospace": "#0891B2",
  "Defense & Space Systems": "#0891B2",
  "social media": "#EC4899",
  "Social Media": "#EC4899",
  "social media technology": "#F472B6",
  "Social Media/Technology": "#F472B6",
  "Social Media and Technology": "#F472B6",
  "Social Media Technology": "#F472B6",
  "Technology/Social Media": "#F472B6",
  "technology/social media": "#F472B6",
  "social media/technology": "#F472B6",
  "e-commerce": "#14B8A6",
  "E-commerce": "#14B8A6",
  "e-commerce/social media": "#14B8A6",
  "E-commerce/Technology": "#14B8A6",
  transportation: "#84CC16",
  Transportation: "#84CC16",
  "Transportation/Technology": "#84CC16",
  "Transportation/Tech": "#84CC16",
  "transportation technology": "#84CC16",
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
  "professional services": "#A16207",
  "Professional Services": "#A16207",
  "professional services financial services": "#A16207",
  "government consulting": "#A16207",
  "technology consulting": "#A16207",
  "technology services": "#B45309",
  "Technology Services": "#B45309",
  "IT services": "#D97706",
  "IT Services": "#D97706",
  "it services": "#D97706",
  "managed services": "#F59E0B",
  insurance: "#DC2626",
  Insurance: "#DC2626",
  "media/entertainment": "#7C3AED",
  "Media/Entertainment": "#7C3AED",
  "media and entertainment": "#7C3AED",
  "entertainment and media": "#7C3AED",
  "media technology": "#8B5CF6",
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
  "semiconductor/technology": "#64748B",
  "Microelectronics & Semiconductor": "#475569",
  "Electronic Design Automation": "#334155",
  "eda/electronics": "#334155",
  "electronic design automation": "#475569",
  "AI/Technology": "#6366F1",
  SaaS: "#3B82F6",
  "SaaS/Process Mining": "#60A5FA",
  saas: "#3B82F6",
  "saas process mining": "#60A5FA",
  "enterprise software": "#2563EB",
  software: "#3B82F6",
  "software development": "#1E40AF",
  "software development tools": "#1E40AF",
  gaming: "#A855F7",
  "real estate technology": "#06B6D4",
  cryptocurrency: "#F59E0B",
  "ai/audio": "#6e55d3",
  "cryptocurrency/fintech": "#FBBF24",
  "Blockchain/DeFi": "#F59E0B",
  "advertising technology": "#F97316",
  "Advertising/Technology": "#F97316",
  advertising: "#FB923C",
  Advertising: "#FB923C",
  "Art and Luxury": "#DC2626",
  "retail technology": "#14B8A6",
  "privacy and data protection": "#DC2626",
  "IoT/connected operations": "#06B6D4",
  "iot connected operations": "#06B6D4",
  "crm and ai": "#6366F1",
  tech: "#3B82F6",
  "gis software": "#10B981",
  "workforce management": "#8B5CF6",
  "HR technology": "#8B5CF6",
  "Food Service": "#D97706",
  Restaurant: "#D97706",
  "Consumer Goods": "#EF4444",
  Automotive: "#475569",
  automotive: "#475569",
  "National Security": "#7C3AED",
  "Nuclear Energy": "#FBBF24",
  "information technology": "#3B82F6",
  "algorithmic trading": "#FBBF24",
  "data platform technology": "#6366F1",
  "time series database technology": "#3B82F6",
  "shipping and packaging distribution": "#84CC16",
  Defense: "#7C3AED",
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
  const normIndustry = industry.split(",")[0].toLowerCase();
  return INDUSTRY_COLORS[normIndustry] || "#9CA3AF"; // Gray fallback
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
