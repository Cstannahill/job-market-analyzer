import { toProperCase } from "@/lib/stringHelpers";
import React from "react";

type ModuleShape = { default?: string; ReactComponent?: React.ComponentType<React.SVGProps<SVGSVGElement>> };

// adjust path to where TechBadgeSvgr lives relative to src/assets/icons
const modules = import.meta.glob('/src/assets/icons/*.svg', { eager: true }) as Record<string, ModuleShape>;

// build icon map: filename (sanitized) -> { url, Comp? }
const iconMap: Record<string, { url?: string; Comp?: ModuleShape["ReactComponent"] }> = {};

Object.keys(modules).forEach((p) => {
    const file = p.split("/").pop() || p;
    const key = file.replace(/\.svg$/, "").toLowerCase();
    iconMap[key] = {
        url: modules[p].default,
        Comp: modules[p].ReactComponent,
    };
});

function normalizeLookup(name: string) {
    return name
        .toLowerCase()
        .replace(/^c#$/, "c-sharp")           // optional normalization rule
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
}

export type Props = {
    name: string;
    size?: number;
    className?: string;
    hideLabel?: boolean;
};

export default function TechBadgeSvgr({ name, size = 20, className = "", hideLabel = true }: Props) {
    const key = normalizeLookup(name);
    const entry = iconMap[key];

    return (
        <div className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${className}`} title={name} aria-label={name}>
            {entry?.Comp ? (
                // If ReactComponent is present (rare in your current output), render it
                <entry.Comp width={size} height={size} aria-hidden className="flex-shrink-0" />
            ) : entry?.url ? (
                // Most modules will come here: render the url as an <img/>
                <div className="inline-flex text-black items-center rounded-full bg-white/5 p-1.5 shadow-sm">
                    <div className="w-7 h-7 text-background rounded-full flex items-center justify-center bg-white/10">
                        <img src={entry.url} alt={toProperCase(name)} className="w-full h-full object-contain" />
                    </div>
                </div>

            ) : (
                // final fallback: letter circle
                <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-gray-200 text-sm" aria-hidden>
                    {name.charAt(0)}
                </div>
            )}
            {!hideLabel && <span className="hidden sm:inline">{name}</span>}
        </div>
    );
}