import FiltersBar from "@/components/trends-v2/FiltersBar";
import { TechSearchCombobox, type TechOption, type TechSearchValue } from "@/components/postings/TechSearchCombobox";
import type { Region, Period } from "@job-market-analyzer/types/trendsv2";

type Props = {
  region: Region;
  weeks: string[];
  period: Period;
  onFiltersChange: (next: { region: Region; period: Period }) => void;
  techValue: TechSearchValue;
  onTechChange: (next: TechSearchValue) => void;
  onTechCommit: (next: TechSearchValue) => void;
  techOptions: TechOption[];
  disabled?: boolean;
};

export function TrendsV2Controls({
  region,
  weeks,
  period,
  onFiltersChange,
  techValue,
  onTechChange,
  onTechCommit,
  techOptions,
  disabled,
}: Props) {
  return (
    <div style={{ padding: "1rem", margin: ".1rem 0 0.1rem 0" }} className="sticky rounded-md top-20 sm:top-0 z-20 border border-white/5 bg-slate-900/40 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-3 py-4">
        <FiltersBar
          region={region}
          weeks={weeks}
          period={period}
          onChange={onFiltersChange}
        />
        <TechSearchCombobox
          value={techValue}
          onChange={onTechChange}
          onCommit={onTechCommit}
          options={techOptions}
          placeholder="Select technology"
          inputPlaceholder="Search technologies…"
          widthClass="w-full md:w-[320px]"
          contentWidthClass="w-[320px]"
          disabled={disabled}
          maxVisible={techOptions.length || 10}
        />
      </div>
    </div>
  );
}
