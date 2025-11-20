import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTop,
  getRising,
  getTechDetail,
  getWeeks,
} from "@/services/trendsv2Service";
import type {
  Region,
  Period,
  TopTechnologiesItem,
  TechnologyDetailResponse,
} from "@job-market-analyzer/types/trendsv2";

type UseTrendsV2DataOptions = {
  initialRegion: Region;
  initialPeriod: Period;
  topLimit?: number;
  risingLimit?: number;
};

export function useTrendsV2Data({
  initialRegion,
  initialPeriod,
  topLimit = 36,
  risingLimit = 12,
}: UseTrendsV2DataOptions) {
  const [region, setRegion] = useState<Region>(initialRegion);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [top, setTop] = useState<TopTechnologiesItem[]>([]);
  const [rising, setRising] = useState<TopTechnologiesItem[]>([]);
  const [selected, setSelected] = useState<TopTechnologiesItem | null>(null);
  const [detail, setDetail] = useState<TechnologyDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const requestRef = useRef(0);

  const selectTech = useCallback(
    async (item: TopTechnologiesItem | null) => {
      requestRef.current += 1;
      const requestId = requestRef.current;

      if (!item) {
        setSelected(null);
        setDetail(null);
        setDetailLoading(false);
        return;
      }

      setSelected(item);
      setDetail(null);
      setDetailLoading(true);

      try {
        const data = await getTechDetail({
          name: item.skill_canonical,
          region,
          period,
        });

        if (requestRef.current === requestId) {
          setDetail(data);
        }
      } catch (error) {
        if (requestRef.current === requestId) {
          console.error("Failed to load tech detail", error);
          setDetail(null);
        }
      } finally {
        if (requestRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [period, region]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [topData, risingData, weeks] = await Promise.all([
          getTop({ region, period, limit: topLimit }),
          getRising({ region, period, limit: risingLimit }),
          getWeeks(),
        ]);
        if (!active) return;
        setWeeks(weeks);
        setTop(topData);
        setRising(risingData);
        setLoading(false);
        selectTech(topData[0] ?? null);
      } catch (error) {
        if (active) {
          console.error("Failed to load trends data", error);
          setWeeks([""]);
          setTop([]);
          setRising([]);
          setLoading(false);
          selectTech(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [period, region, risingLimit, selectTech, topLimit]);

  return {
    region,
    weeks,
    setRegion,
    period,
    setPeriod,
    top,
    rising,
    selected,
    detail,
    selectTech,
    loading,
    detailLoading,
  };
}
