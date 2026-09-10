import { GetMinuteStartNowTimestampUTC, Wait } from "../tool.js";
import GC from "../../global-constants.js";
import type { GroupMonitor, GroupMonitorMember, MonitoringResult } from "../types/monitor.js";
import { GetLastMonitoringValue } from "../cache/setGet.js";
import { GetLatestMonitoringData } from "../controllers/controller.js";

const POLL_INTERVAL_MS = 250;

interface MemberSample {
  timestamp: number;
  status: string;
  latency: number;
}

/**
 * Numeric scores for each status (normalized 0–1).
 * UP = 1, DEGRADED = 0.5, DOWN = 0
 * MAINTENANCE members are treated as UP (score 1).
 *
 * Weighted sum = Σ(weight × score), weights should sum to 1.
 * Result: 1 → UP, (0, 1) → DEGRADED, 0 → DOWN
 */
const STATUS_SCORE: Record<string, number> = {
  [GC.UP]: 1,
  [GC.DEGRADED]: 0.5,
  [GC.DOWN]: 0,
};

/** Map a weighted score back to a status string. */
function scoreToStatus(score: number): string {
  if (score >= 1) return GC.UP;
  if (score > 0) return GC.DEGRADED;
  return GC.DOWN;
}

class GroupCall {
  monitor: GroupMonitor;

  constructor(monitor: GroupMonitor, _timestamp?: number) {
    this.monitor = monitor;
  }

  /**
   * Members usually run on the same cron tick as the group, and their results only reach the
   * cache after a second queue hop, so reading it straight away yields the previous minute's
   * statuses. Poll until every member has reported for this minute, capped by executionDelay.
   */
  private async collectMemberData(
    members: GroupMonitorMember[],
    startOfMinute: number,
  ): Promise<Map<string, MemberSample>> {
    const budgetMs = Math.max(0, parseInt(String(this.monitor.type_data.executionDelay)) || 1000);
    const deadline = Date.now() + budgetMs;
    const statusMap = new Map<string, MemberSample>();

    for (;;) {
      let stale = 0;

      for (const member of members) {
        if ((statusMap.get(member.tag)?.timestamp ?? -1) >= startOfMinute) continue;

        const lastObj = await GetLastMonitoringValue(member.tag, () => GetLatestMonitoringData(member.tag));
        if (lastObj) {
          statusMap.set(member.tag, {
            timestamp: lastObj.timestamp,
            status: lastObj.status ?? "",
            latency: lastObj.latency ?? 0,
          });
        }
        if ((lastObj?.timestamp ?? -1) < startOfMinute) stale++;
      }

      // Members on a slower cron than the group never report every minute, so a timeout is
      // the normal exit here and the last known status is used for them.
      if (stale === 0 || Date.now() >= deadline) return statusMap;
      await Wait(POLL_INTERVAL_MS);
    }
  }

  async execute(startOfMinute?: number): Promise<MonitoringResult> {
    if (!startOfMinute) {
      startOfMinute = GetMinuteStartNowTimestampUTC();
    }
    const members = this.monitor.type_data.monitors;

    // Collect each member's latest status + latency
    const statusMap = await this.collectMemberData(members, startOfMinute);

    // --- Latency calculation ---
    const latencyValues = [...statusMap.values()].map((v) => v.latency);
    const latencyCalculationType = this.monitor.type_data.latencyCalculation || "AVG";
    let latency = 0;
    if (latencyValues.length > 0) {
      if (latencyCalculationType === "AVG") {
        latency = latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length;
      } else if (latencyCalculationType === "MAX") {
        latency = Math.max(...latencyValues);
      } else if (latencyCalculationType === "MIN") {
        latency = Math.min(...latencyValues);
      }
    }

    // --- Status calculation via weighted scores ---
    // Each status has a normalized score: UP=1, DEGRADED=0.5, DOWN=0
    // MAINTENANCE members are treated as UP (score 1).
    // Weighted sum = Σ(weight × score), weights should sum to 1.
    // Result: 1 → UP, (0,1) → DEGRADED, 0 → DOWN
    let weightedScore = 0;
    let totalWeight = 0;

    for (const member of members) {
      const data = statusMap.get(member.tag);
      if (!data) continue;
      const score = STATUS_SCORE[data.status] ?? 1;
      weightedScore += member.weight * score;
      totalWeight += member.weight;
    }

    // Normalize if weights don't sum to 1 (safety net)
    if (totalWeight > 0 && totalWeight !== 1) {
      weightedScore = weightedScore / totalWeight;
    }

    const status = scoreToStatus(weightedScore);

    return { status, latency, type: GC.REALTIME };
  }
}

export default GroupCall;
