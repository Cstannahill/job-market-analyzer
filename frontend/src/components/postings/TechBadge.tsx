
export interface TechBadgeProps {
    name: string;
    className?: string;
    size?: number;
};

const iconFor = (name: string) => {
    const key = name.toLowerCase().replace(/\s+/g, "-").replace(/\.+/g, "");
    try {
        console.log(key);
        console.log(`/assets/icons/${key}.svg`)
        return new URL(`/assets/icons/${key}.svg`, import.meta.url).href;
    } catch {
        return null;
    }
};

export default function TechBadge({ tech }: { tech: TechBadgeProps }) {
    console.log(` Tech: ${tech.name}`);
    const { name, className = "", size = 28 } = tech;
    const src = iconFor(name);

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${className}`}
            role="img"
            aria-label={name}
            title={name}
        >
            {src ? (
                <img src={src} alt={name + " logo"} width={size} height={size} className="inline-block" />
            ) : (
                <span className="inline-block w-7 h-7 rounded bg-gray-200 text-center leading-7">
                    {name.charAt(0)}
                </span>
            )}
            <span className="hidden sm:inline">{name}</span>
        </div>
    );
}
