import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REPORT_SETTINGS, reportAvailability } from "../src/lib/reports/settings.ts";

const at = (settings, utc) => reportAvailability(settings, new Date(utc));

test("report schedule uses Saltillo time and includes the last minute", () => {
  const weekdays = { ...DEFAULT_REPORT_SETTINGS, days: [0, 1, 2, 3, 4], from: "09:00", until: "18:00" };
  assert.deepEqual(at(weekdays, "2026-11-27T14:59:00Z"), { open: false, next: "viernes, 27 de noviembre a las 09:00" });
  assert.equal(at(weekdays, "2026-11-27T15:00:00Z").open, true);
  assert.equal(at(weekdays, "2026-11-28T00:00:59Z").open, true);
  assert.deepEqual(at(weekdays, "2026-11-28T00:01:00Z"), { open: false, next: "lunes, 30 de noviembre a las 09:00" });
});

test("overnight reports follow the day on which reception opened", () => {
  const friday = { ...DEFAULT_REPORT_SETTINGS, days: [4], from: "22:00", until: "02:00" };
  assert.equal(at(friday, "2026-11-28T07:30:00Z").open, true);
  assert.deepEqual(at(friday, "2026-11-28T08:01:00Z"), { open: false, next: "viernes, 4 de diciembre a las 22:00" });
});

test("no active days pauses report intake and the default stays open at midnight", () => {
  assert.deepEqual(at({ ...DEFAULT_REPORT_SETTINGS, days: [] }, "2026-11-27T06:00:00Z"), { open: false, next: null });
  assert.equal(at(DEFAULT_REPORT_SETTINGS, "2026-11-27T06:00:00Z").open, true);
});
