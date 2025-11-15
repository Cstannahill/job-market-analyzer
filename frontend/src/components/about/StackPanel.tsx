import { Card, } from "@/components/ui/card";


/* -------------------------
   StackPanel (updated to show svg icons)
   - expects icon SVGs in /public/icons/
--------------------------*/
export const StackPanel: React.FC<{
    stackItems: { name: string; iconPath?: string, type: "frontend" | "backend" | "storage" }[]; // iconPath relative to /public
    principles: string[];
}> = ({ stackItems, principles }) => {

    const mapStack = (item: { name: string; iconPath?: string, type: string }, target: "frontend" | "backend" | "storage") => {
        const normalized = item.iconPath
            ? item.iconPath.startsWith("/")
                ? item.iconPath
                : item.iconPath.startsWith("icons/")
                    ? `/${item.iconPath}`
                    : `/icons/${item.iconPath}`
            : undefined;

        if (item.type === target && normalized) {
            return (

                <li key={item.name} className="grid items-center text-center">
                    {normalized ? (
                        <img
                            src={normalized}
                            alt={item.name}
                            className="w-8 h-8 rounded-md bg-card justify-self-center"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                // hide image if it fails to load
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    ) : (
                        <></>
                    )}
                    <span className="text-xs text-foreground nf-mono">{item.name}</span>
                </li>

            );
        }
    }
    const frontendItems = stackItems.filter(item => item.type === "frontend").map(item => mapStack(item, "frontend"));
    const backendItems = stackItems.filter(item => item.type === "backend").map(item => mapStack(item, "backend"));
    const storageItems = stackItems.filter(item => item.type === "storage").map(item => mapStack(item, "storage"));

    return (<>
        <h5 className="text-lg font-bold text-foreground my-2 text-center">Stack</h5>
        <Card className="stack-panel-card flex flex-col gap-4 lg:flex-row justify-between border border-border/60 backdrop-blur-sm w-full">
            <div className="w-full m-0 p-0">

                {frontendItems.length > 0 && (
                    <>
                        <p className="text-md  text-foreground my-1 border-b-1 py-0 font-bold text-center ">Frontend</p>
                        <ul className="flex flex-wrap justify-center gap-4 p-4 border-b-2 border-border">
                            {frontendItems}
                        </ul>
                    </>
                )}
                {backendItems.length > 0 && (
                    <div>
                        <p className="text-md  text-foreground my-1 border-b-1 py-0 font-bold text-center ">Backend</p>
                        <ul className="flex flex-wrap justify-center gap-4 p-4 border-b-2 border-border">
                            {backendItems}</ul>
                    </div>
                )}
                {storageItems.length > 0 && (
                    <div>
                        <p className="text-md  text-foreground my-1 border-b-1 py-0 font-bold text-center ">Storage</p>
                        <ul className="flex flex-wrap justify-center gap-4 p-4">
                            {storageItems}
                        </ul>

                    </div>
                )}
            </div>
            <Card className="stack-panel-principles z-10 bg-foreground/5 w-full lg:w-auto">
                <div>
                    <h4 className="text-mdfont-bold text-foreground mb-3 text-center">Data Principles</h4>
                    <ul className="space-y-3">
                        {principles.map((p) => (
                            <li key={p} className="flex items-start gap-3">
                                <svg
                                    className="mt-1 w-4 h-4 shrink-0 text-foreground"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden
                                >
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="0.6" opacity="0.18" />
                                    <path d="M8 12l2.2 2.2L16 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="text-sm text-foreground">{p}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </Card>


        </Card></>
    );
};
