import { toProperCase } from "@/lib/stringHelpers";
import { getCompanyIconColor } from "@/lib/utils/companyHelpers";
import React, { type JSX, useState, useEffect } from "react";

export type ModuleShape = { default?: string; ReactComponent?: React.ComponentType<React.SVGProps<SVGSVGElement>> };

// Lazy load modules
const moduleLoaders = import.meta.glob('/src/assets/companyIcons/*.{svg,SVG}', {
    eager: false,
    import: 'default'
}) as Record<string, () => Promise<string>>;

// Cache for loaded icons
const iconCache = new Map<string, string>();

function normalizeLookup(name: string) {
    const lower = name.toLowerCase();
    if (lower === "ci&t") return "cit";

    // Special cases - consolidated for readability
    const specialCases: Record<string, string> = {
        'andurilindustries': 'anduril-industries',
        "ciandt": "cit",
        "hubspotjobs": "hubspot"


    };

    if (specialCases[lower]) return specialCases[lower];

    // Pattern-based special cases
    if (lower.includes("gitlab")) return "gitlab";


    // Default normalization
    return name
        .toLowerCase()
        .replace(/^c#$/, "csharp")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
}

// const checkNameLength = (name: string) => {
//     return name.length > 15 && (name.includes("-") || name.includes(" "));
// }

const mapNameColumnRows = (namePart: string, index: number): JSX.Element => {
    return (<div className="flex-row" key={index}>{toProperCase(namePart)}</div>);
}

export type Props = {
    name: string;
    size?: number;
    className?: string;
    hideLabel?: boolean;
    roundStyle: "none" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

export default function CompanyBadgeSvgr({
    name,
    size = 20,
    className = "",
    hideLabel = false,
    roundStyle = "md"
}: Props) {
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const key = normalizeLookup(name);
    const iconPath = `/src/assets/companyIcons/${key}.svg`;

    useEffect(() => {
        // Check cache first
        if (iconCache.has(key)) {
            setIconUrl(iconCache.get(key)!);
            setLoading(false);
            return;
        }

        // Load icon dynamically
        const loader = moduleLoaders[iconPath];
        if (loader) {
            loader().then((url) => {
                iconCache.set(key, url);
                setIconUrl(url);
                setLoading(false);
            }).catch(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [key, iconPath]);

    // Fix dynamic Tailwind classes - use style prop instead
    const sizeStyle = { width: size, height: size };

    // Map roundStyle to actual Tailwind classes
    const roundClasses = {
        'none': 'rounded-none',
        '2xs': 'rounded-sm',
        'xs': 'rounded',
        'sm': 'rounded-md',
        'md': 'rounded-lg',
        'lg': 'rounded-xl',
        'xl': 'rounded-2xl',
        '2xl': 'rounded-3xl',
        'full': 'rounded-full'
    };
    const label = (name ?? key ?? "").trim();
    const parts = label.split(/[-\s]+/).filter(Boolean);

    const shouldColumnize = parts.length > 1;
    return (
        <div
            style={{ alignSelf: "start" }}
            className={`inline-flex flex-col items-center gap-2 px-2 py-1 text-xs font-medium ${className}`}
            title={""}
            aria-label={name}
        >
            {loading ? (
                // Loading skeleton
                <div
                    className={`${roundClasses[roundStyle]} inline-flex items-center bg-zinc-800 p-1.5 shadow-sm animate-pulse`}
                    style={sizeStyle}
                />
            ) : iconUrl ? (
                // Render loaded icon
                <div className={`${roundClasses[roundStyle]} inline-flex text-black items-center bg-white/5 p-1.5 shadow-sm`}>
                    <div
                        className={`${roundClasses[roundStyle]} flex items-center justify-center bg-white/10`}
                        style={sizeStyle}
                    >
                        <img
                            src={iconUrl}
                            alt={toProperCase(name)}
                            style={{ objectFit: "contain", backgroundColor: getCompanyIconColor(name) }}
                            className={`${roundClasses[roundStyle]} w-full h-full object-contain bg-zinc-100/10 company-icon`}
                        />
                    </div>
                </div>
            ) : (
                // Fallback: letter circle
                <div
                    style={sizeStyle}
                    className={`${roundClasses[roundStyle]} flex items-center justify-center bg-gray-500 text-sm`}
                    aria-hidden
                >
                    {name.charAt(0).toUpperCase()}
                </div>
            )}

            {!hideLabel && (
                <small style={{ fontWeight: "bold" }} className="text-black company-icon-svg-label">
                    {label.length < 4
                        ? label.toUpperCase()
                        : shouldColumnize
                            ? <div className="flex flex-col">{parts.map(mapNameColumnRows)}</div>
                            : toProperCase(label)
                    }
                </small>
            )}
        </div>
    );
}