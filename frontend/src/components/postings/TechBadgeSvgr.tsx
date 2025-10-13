import { toProperCase } from "@/lib/stringHelpers";
import React, { type JSX } from "react";

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
    if (name.toLowerCase().includes("database")) {
        console.log("Database found in name sent to normalizer:", name);
        checkNameLength(name);
        // const nameLength = name.length;
        // const nameArray = name.split(" ");


    }
    if (name.toLowerCase() === "llms") return "llm"; // special case
    if (name.toLowerCase() === "rags" || name.toLowerCase().includes("rag") && name.toLowerCase().includes("pipeline")) return "rag"; // special case
    if (name.toLowerCase().includes("java/")) return "java"; // special case
    if (name.toLowerCase().includes("postgre") || name.toLowerCase().includes("sql")) return "postgresql"; // special case
    if (name.toLowerCase() === "rails" || name.toLowerCase() === "ruby on rails") return "rails"; // special case
    if (name.toLowerCase() === "rest" || name.toLowerCase().includes("rest") && name.toLowerCase().includes("api")) return "rest"; // special case
    if (name.toLowerCase() === "aws" || name.toLowerCase().includes("web services") && name.toLowerCase().includes("web services")) return "aws"; // special case
    if (name.toLowerCase().includes("juniper")) return "juniper"; // special case
    if (name === "C++" || name === "C ++" || name === "C + +" || name === "CPlusPlus" || name === "Cpp" || name.toLowerCase() === "c++" || name.toLowerCase() === "c plus plus" || name.toLowerCase() === "c + +" || name === "c ++") return "cpp"; // special case
    if (name.toLowerCase() === "app engine") return "appengine"; // special case
    if (name.toLowerCase() === "asp.net") return "aspnet"; // special case
    if (name.toLowerCase().includes("spring") || name.toLowerCase() === "next") return "spring"; // special case
    return name
        .toLowerCase()
        .replace(/^c#$/, "csharp")           // optional normalization rule
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");

}

const checkNameLength = (name: string) => {
    return name.length > 15 && (name.includes("-") || name.includes(" "));
}



const mapNameColumnRows = (namePart: string, index: number): JSX.Element => {
    console.log("Mapping name part:", namePart);
    return (<div className="flex-row" key={index}>{namePart.toProperCase()}</div>)
}

export type Props = {
    name: string;
    size?: number;
    className?: string;
    hideLabel?: boolean;
    roundStyle: "none" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

export default function TechBadgeSvgr({ name, size = 20, className = "", hideLabel = false, roundStyle = "md" }: Props) {
    const key = normalizeLookup(name);
    if (key.toLowerCase().includes("database")) {
        console.log("Database key:", key);
        console.log("Database name:", name);
        const keyCheck = checkNameLength(key);
        const nameCheck = checkNameLength(name);
        console.log("Key length check (>15 & includes '-' or ' '):", keyCheck);
        console.log("Name length check (>15 & includes '-' or ' '):", nameCheck);
    }
    const entry = iconMap[key];
    const sizeClass = `w-${size} h-${size}`;
    return (
        <div className={`inline-flex flex-col items-center gap-2 px-2 py-1 text-xs font-medium ${className}`} title={name} aria-label={name}>
            {entry?.Comp ? (
                // If ReactComponent is present (rare in your current output), render it
                <entry.Comp width={size} height={size} aria-hidden className="flex-shrink-0" />
            ) : entry?.url ? (
                // Most modules will come here: render the url as an <img/>
                <div className={`rounded-${roundStyle} inline-flex text-black items-center  bg-white/5 p-1.5 shadow-sm`}>
                    <div className={`rounded-${roundStyle} ${sizeClass} text-background  flex items-center justify-center bg-white/10`}>
                        <img src={entry.url} alt={toProperCase(name)} className="w-full h-full object-contain" />
                    </div>
                </div>

            ) : (
                // final fallback: letter circle
                <div style={{ width: size, height: size }} className={`rounded-${roundStyle} flex items-center justify-center  bg-gray-200 text-sm`} aria-hidden>
                    {name.charAt(0)}
                </div>
            )}

            {!hideLabel && <small className="text-black tech-icon-svg-label truncate">
                {name && name.length < 4 ? name.toUpperCase() : name.length > 3 && name.length < 15 ? toProperCase(name) : key.length > 15 && key.includes("-") &&
                    <div className="flex flex-col">{key.split("-").map(mapNameColumnRows)}</div>}</small>}

        </div>
    );
}