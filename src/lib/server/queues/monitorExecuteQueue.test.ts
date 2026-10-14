import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonitorRecordTyped } from "../types/db.js";
import type { MonitoringResultTS } from "../types/monitor.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  incidents: vi.fn(),
  maintenances: vi.fn(),
  confirmed: vi.fn(),
  response: vi.fn(),
  add: vi.fn(),
  createWorker: vi.fn(
    (
      _queue: unknown,
      _handler: (job: { data: { monitor: MonitorRecordTyped; ts: number } }) => Promise<MonitoringResultTS>,
      _options: { concurrency: number },
    ) => ({ on: vi.fn() }),
  ),
}));

vi.mock("./q.js", () => ({
  default: {
    createQueue: () => ({ add: mocks.add }),
    createWorker: mocks.createWorker,
  },
}));
vi.mock("../services/service.js", () => ({
  default: class {
    execute = mocks.execute;
  },
}));
vi.mock("../db/db.js", () => ({
  default: {
    getIncidentsByMonitorTagRealtime: mocks.incidents,
    getMaintenancesByMonitorTagRealtime: mocks.maintenances,
  },
}));
vi.mock("./monitorResponseQueue", () => ({ default: { push: mocks.response } }));
vi.mock("../services/confirmationThreshold.js", () => ({ resolveConfirmedStatus: mocks.confirmed }));

describe("merged monitor execution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("MONITOR_EXECUTE_CONCURRENCY", "73");
    mocks.incidents.mockResolvedValue([]);
    mocks.maintenances.mockResolvedValue([]);
    mocks.execute.mockResolvedValue({ status: "DOWN", latency: 42, type: "TIMEOUT", error_message: "Timed out" });
    mocks.confirmed.mockResolvedValue({ status: "UP", pendingHold: true });
  });

  afterEach(() => vi.unstubAllEnvs());

  async function execute() {
    const { push } = await import("./monitorExecuteQueue.js");
    const monitor = { tag: "api", confirmation_threshold: 2 } as MonitorRecordTyped;
    await push(monitor, 600);
    expect(mocks.createWorker.mock.calls[0][2]).toEqual({ concurrency: 73 });
    return mocks.createWorker.mock.calls[0][1]({ data: { monitor, ts: 600 } });
  }

  it("applies confirmation thresholds and submits each sample only once", async () => {
    const result = await execute();
    expect(result[600]).toMatchObject({ status: "UP", raw_status: "DOWN", latency: 42, type: "TIMEOUT" });
    expect(result[600].error_message).toContain("Timed out");
    expect(mocks.confirmed).toHaveBeenCalledOnce();
    expect(mocks.response).toHaveBeenCalledExactlyOnceWith("api", 600, result[600]);
  });

  it("keeps maintenance overlays aligned to the job minute without losing raw status or latency", async () => {
    mocks.maintenances.mockResolvedValue([{ monitor_impact: "MAINTENANCE" }]);
    const result = await execute();
    expect(result[600]).toMatchObject({ status: "MAINTENANCE", raw_status: "DOWN", latency: 42 });
    expect(mocks.maintenances).toHaveBeenCalledWith("api", 600);
    expect(mocks.confirmed).not.toHaveBeenCalled();
    expect(mocks.response).toHaveBeenCalledExactlyOnceWith("api", 600, result[600]);
  });
});
