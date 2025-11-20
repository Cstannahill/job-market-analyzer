export function CellCard({
    title,
    count,
    p50,
}: {
    title: string;
    count: number;
    p50?: number;
}) {
    return (
        <div style={{ padding: ".25rem .5rem" }} className="rounded-md p-2 bg-slate-900/50 border border-slate-800">
            <div className="text-xs text-slate-400">{title}</div>
            <div className="text-sm text-white font-mono">{count}</div>
            <div className="text-[11px] text-slate-400">
                p50 <span className="font-bold">${(p50 ?? 0).toLocaleString()}</span>
            </div>
        </div>
    );
}