import { toProperCase } from "@/lib/stringHelpers";
import React, { type JSX, useState, useEffect } from "react";

export type ModuleShape = { default?: string; ReactComponent?: React.ComponentType<React.SVGProps<SVGSVGElement>> };

// Lazy load modules
const moduleLoaders = import.meta.glob('/src/assets/icons/*.{svg,SVG}', {
    eager: false,
    import: 'default'
}) as Record<string, () => Promise<string>>;

// Cache for loaded icons
const iconCache = new Map<string, string>();

function normalizeLookup(name: string) {
    const lower = name.toLowerCase();

    // Special cases - consolidated for readability
    const specialCases: Record<string, string> = {
        'llms': 'llm',
        'rails': 'rails',
        'ruby on rails': 'rails',
        'aws': 'aws',
        "c/c++": "cpp",
        'c++': 'cpp',
        'c ++': 'cpp',
        'c + +': 'cpp',
        'cplusplus': 'cpp',
        'cpp': 'cpp',
        'c plus plus': 'cpp',
        'app engine': 'appengine',
        'asp.net': 'aspnet',
        "vue.js": "vue"

    };

    if (specialCases[lower]) return specialCases[lower];

    // Pattern-based special cases
    if (lower.includes("gitlab")) return "gitlab";
    if (lower.includes("kotlin")) return "kotlin";
    if (lower === "cloudflare" || lower.includes("cloudflare")) return "cloudflare";
    if (lower.includes("next.js") || lower.includes("nextjs")) return "next";
    if (lower.includes('html')) return 'html5';
    if (lower.includes('css')) return 'css3';
    if (lower.includes('node') || lower.includes('node.js')) return 'node';
    if (lower === 'database' || lower === 'databases') return 'database-management-systems';
    if (lower.includes('java') && !lower.includes('javascript')) return 'java';
    if (lower.includes('android')) return 'android';
    if (lower.includes('cloud platform')) return 'cloud';
    if (lower.includes('react')) return 'react';
    if (lower.includes('google cloud')) return 'gcp';
    if (lower === 'go' || lower === 'golang' || lower.includes('golang') || (lower.includes("go lang"))) return 'golang';
    if (lower.includes('java/')) return 'java';
    if (lower.includes('postgre') || lower.includes('sql')) return 'postgresql';
    if (lower.includes('rag') && lower.includes('pipeline')) return 'rag';
    if (lower === 'rags') return 'rag';
    if (lower.includes('rest') && lower.includes('api')) return 'rest';
    if (lower === 'rest') return 'rest';
    if (lower.includes('web services')) return 'aws';
    if (lower.includes('juniper')) return 'juniper';
    if (lower.includes('spring') || lower === 'springboot') return 'spring';

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

export default function TechBadgeSvgr({
    name,
    size = 20,
    className = "",
    hideLabel = false,
    roundStyle = "md"
}: Props) {
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const key = normalizeLookup(name);
    const iconPath = `/src/assets/icons/${key}.svg`;

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

    const shouldColumnize = label.length > 14 && parts.length > 1;
    return (
        <div
            style={{ alignSelf: "start" }}
            className={`inline-flex flex-col items-center gap-2 px-2 py-1 text-xs font-medium ${className}`}
            title={name}
            aria-label={name}
        >
            {loading ? (
                // Loading skeleton
                <div
                    className={`${roundClasses[roundStyle]} inline-flex items-center bg-gray-200 p-1.5 shadow-sm animate-pulse`}
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
                            className="w-full h-full object-contain company-icon"
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
                <small className="text-black tech-icon-svg-label">
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