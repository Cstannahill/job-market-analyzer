import { describe, it, expect } from "vitest";
import {
  hashFromProviderFields,
  normCompany,
  normTitle,
  normLocation,
  normDate,
} from "./dedupe.js";

describe("canonicalization helpers", () => {
  it("normalizes company names consistently", () => {
    expect(normCompany("Google LLC")).toBe(normCompany("google llc"));
    expect(normCompany("Meta Platforms, Inc.")).toBe(
      normCompany("meta platforms inc")
    );
    expect(normCompany("Meta")).toBe(normCompany("Meta, Inc."));
  });

  it("normalizes titles consistently", () => {
    expect(normTitle("Senior Software Engineer (Remote)")).toBe(
      "senior software engineer"
    );
    expect(normTitle("Senior Software Engineer - Reality Labs")).toBe(
      "senior software engineer"
    );
  });

  it("normalizes date", () => {
    expect(normDate("2025-10-21T12:34:56Z")).toBe("2025-10-21");
    expect(normDate(new Date("2025-10-21T00:00:00Z").getTime())).toBe(
      "2025-10-21"
    );
  });

  it("normalizes location", () => {
    const a = normLocation("San Francisco, CA, US");
    const b = normLocation(undefined, "San Francisco", "CA", "US");
    expect(a.token).toBe(b.token);
  });
});

describe("hashFromProviderFields → same real job ⇒ same hash", () => {
  it("Muse vs Greenhouse vs Lever variants map to same postingHash", () => {
    const muse = hashFromProviderFields({
      company: "Meta Platforms, Inc.",
      title: "Senior Software Engineer (Remote)",
      locationRaw: "San Francisco, CA, US",
      postedDate: "2025-10-15T08:00:00Z",
    });

    const greenhouse = hashFromProviderFields({
      company: "Meta",
      title: "Senior Software Engineer - Reality Labs",
      city: "San Francisco",
      region: "CA",
      country: "US",
      postedDate: "2025-10-15",
    });

    const lever = hashFromProviderFields({
      company: "META INC", // intentionally ugly
      title: "Senior Software Engineer",
      locationRaw: "San Francisco, California, United States",
      postedDate: new Date("2025-10-15").getTime(),
    });

    expect(muse.postingHash).toBe(greenhouse.postingHash);
    expect(muse.postingHash).toBe(lever.postingHash);
  });

  it("different title should yield different hash", () => {
    const a = hashFromProviderFields({
      company: "Meta",
      title: "Senior Software Engineer",
      locationRaw: "Remote - US",
      postedDate: "2025-10-15",
    });

    const b = hashFromProviderFields({
      company: "Meta",
      title: "Staff Software Engineer",
      locationRaw: "Remote - United States",
      postedDate: "2025-10-15",
    });

    expect(a.postingHash).not.toBe(b.postingHash);
  });
});
