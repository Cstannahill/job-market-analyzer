import React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

export type TechOption = {
    value: string;
    label: string;
    count?: number;
};

export type TechSearchValue = {
    tech: string | null;
    query: string;
};

type Props = {
    value: TechSearchValue;
    onChange: (next: TechSearchValue) => void;
    onCommit?: (next: TechSearchValue) => void;
    options: TechOption[];
    placeholder?: string;
    inputPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    showCounts?: boolean;
    widthClass?: string;
    contentWidthClass?: string;
    maxVisible?: number;
};



export function TechSearchCombobox({
    value,
    onChange,
    onCommit,
    options,
    placeholder = "All Technologies",
    inputPlaceholder = "Search tech or type keywords…",
    className,
    disabled,
    showCounts = true,
    widthClass,
    contentWidthClass,
    maxVisible = 20
}: Props) {
    const [open, setOpen] = React.useState(false);
    const [input, setInput] = React.useState(value.query ?? "");



    React.useEffect(() => {
        setInput(value.query ?? "");
    }, [value.query]);

    const [debouncedQuery, cancelDebounce] = useDebouncedCallback<string>(
        (q) => onChange({ tech: null, query: q }),
        250
    );

    const selectedLabel =
        value.tech ?? (value.query ? `Search: "${value.query}"` : null);

    const onPickAll = () => {
        cancelDebounce();
        setOpen(false);
        setInput("");
        const next = { tech: null, query: "" };
        onChange(next);
        onCommit?.(next);
    };

    const onPickTech = (t: TechOption) => {
        cancelDebounce();
        const next = { tech: t.value, query: "" };
        onChange(next);
        onCommit?.(next);
        setOpen(false);
        setInput("");
    };

    const onPressEnter = () => {
        cancelDebounce();
        const q = (input || "").trim();
        const next = { tech: null, query: q };
        onChange(next);
        onCommit?.(next);
        setOpen(false);
    };

    const onClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        cancelDebounce();
        const next = { tech: null, query: "" };
        onChange(next);
        onCommit?.(next);
        setInput("");
    };

    const lower = input.trim().toLowerCase();

    const pool = lower
        ? options.filter(o =>
            o.label.toLowerCase().includes(lower) ||
            o.value.toLowerCase().includes(lower)
        )
        : options;

    const countThenAlpha = (a: TechOption, b: TechOption) => {
        const ca = a.count ?? -1, cb = b.count ?? -1;
        if (cb !== ca) return cb - ca;
        return a.label.localeCompare(b.label);
    };

    const display = [...pool].sort(countThenAlpha).slice(0, maxVisible);

    return (
        <Popover
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) cancelDebounce();
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    disabled={disabled}
                    variant="outline"
                    role="combobox"
                    aria-label="Select technology"
                    aria-expanded={open}
                    style={{ padding: "0rem 1rem" }}
                    className={cn("justify-between", widthClass, className)}
                >
                    <span className="truncate">
                        {selectedLabel ?? placeholder}
                    </span>
                    <div className="flex items-center gap-1">
                        {(value.tech || value.query) && (
                            <X
                                className="h-4 w-4 opacity-70 hover:opacity-100"
                                onClick={onClear}
                                aria-label="Clear"
                            />
                        )}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>

            <PopoverContent className={cn(contentWidthClass ?? widthClass, "max-w-[90vw] p-0")} align="start">
                <Command shouldFilter={false} loop>
                    <CommandInput
                        value={input}
                        onValueChange={(v) => {
                            setInput(v);
                            debouncedQuery(v);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onPressEnter();
                            }
                        }}
                        placeholder={inputPlaceholder}
                        className="h-9"
                    />
                    <CommandList>
                        <CommandEmpty>No matches.</CommandEmpty>

                        {input.trim().length > 0 && (
                            <CommandGroup heading="Actions">
                                <CommandItem
                                    value={`__search__:${input}`}
                                    onSelect={onPressEnter}
                                >
                                    Search “{input.trim()}”
                                </CommandItem>
                            </CommandGroup>
                        )}

                        <CommandGroup heading="Technologies">
                            <CommandItem style={{ padding: "0 1rem" }} value="__all__" onSelect={onPickAll}>
                                All Technologies
                                <Check
                                    className={cn(
                                        "ml-auto h-4 w-4",
                                        !value.tech && !value.query ? "opacity-100" : "opacity-0"
                                    )}
                                />
                            </CommandItem>

                            {display.map((t) => (
                                <CommandItem
                                    key={t.value}
                                    value={t.value}
                                    style={{ padding: "0 1rem" }}
                                    keywords={[t.label]}
                                    onSelect={() => onPickTech(t)}
                                >
                                    <span className="truncate">{t.label}</span>
                                    {showCounts && typeof t.count === "number" && (
                                        <span className="ml-2 text-xs tabular-nums opacity-70">
                                            ({t.count})
                                        </span>
                                    )}
                                    <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            value.tech === t.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
