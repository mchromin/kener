import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupMonitor } from "../types/monitor.js";

const mocks = vi.hoisted(() => ({ latest: vi.fn(), wait: vi.fn() }));
vi.mock("../cache/setGet.js", () => ({ GetLastMonitoringValue: mocks.latest }));
vi.mock("../controllers/controller.js", () => ({ GetLatestMonitoringData: vi.fn() }));
vi.mock("../tool.js", () => ({ GetMinuteStartNowTimestampUTC: () => 600, Wait: mocks.wait }));

import GroupCall from "./groupCall.js";

const monitor = {
  tag: "group",
  type_data: { executionDelay: 250, monitors: [{ tag: "member", weight: 1 }] },
} as GroupMonitor;

describe("group monitor fork behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mocks.wait.mockImplementation(async (duration: number) => vi.setSystemTime(Date.now() + duration));
  });

  afterEach(() => vi.useRealTimers());

  it("waits for the current minute instead of using the previous minute's failure", async () => {
    mocks.latest
      .mockResolvedValueOnce({ timestamp: 540, status: "DOWN", latency: 50 })
      .mockResolvedValueOnce({ timestamp: 600, status: "UP", latency: 12 });
    expect(await new GroupCall(monitor).execute(600)).toMatchObject({ status: "UP", latency: 12 });
    expect(mocks.latest).toHaveBeenCalledTimes(2);
    expect(mocks.wait).toHaveBeenCalledWith(250);
  });

  it("falls back to the latest sample after the polling budget", async () => {
    mocks.latest.mockResolvedValue({ timestamp: 540, status: "DOWN", latency: 50 });
    expect(await new GroupCall(monitor).execute(600)).toMatchObject({ status: "DOWN", latency: 50 });
    expect(mocks.wait).toHaveBeenCalledTimes(1);
  });

  it("treats maintenance members as operational without losing latency", async () => {
    mocks.latest.mockResolvedValue({ timestamp: 600, status: "MAINTENANCE", latency: 20 });
    expect(await new GroupCall(monitor).execute(600)).toMatchObject({ status: "UP", latency: 20 });
    expect(mocks.wait).not.toHaveBeenCalled();
  });
});
