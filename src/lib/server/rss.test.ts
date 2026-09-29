import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPageByPath: vi.fn(),
  getPageMonitorsExcludeHidden: vi.fn().mockResolvedValue([{ monitor_tag: "api" }]),
  getIncidentsForEventsByDateRange: vi.fn().mockResolvedValue([]),
  getMaintenanceEventsForEventsByDateRange: vi.fn().mockResolvedValue([]),
  getAllSiteData: vi.fn(),
}));

vi.mock("./db/db.js", () => ({ default: mocks }));
vi.mock("./controllers/siteDataController.js", () => ({ GetAllSiteData: mocks.getAllSiteData }));

import { renderRssFeedResponse } from "./rss.js";

describe("page RSS visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllSiteData.mockResolvedValue({ siteURL: "https://status.example.com", siteName: "Status" });
  });

  it("does not query or publish events for admin-only pages", async () => {
    mocks.getPageByPath.mockResolvedValue({ id: 1, is_admin_only: "YES" });
    const response = await renderRssFeedResponse({
      scope: { type: "page", pagePath: "private" },
      feedPath: "/private/rss.xml",
    });
    expect(response.status).toBe(404);
    expect(mocks.getPageMonitorsExcludeHidden).not.toHaveBeenCalled();
    expect(mocks.getIncidentsForEventsByDateRange).not.toHaveBeenCalled();
    expect(mocks.getMaintenanceEventsForEventsByDateRange).not.toHaveBeenCalled();
  });

  it("still serves feeds for public pages", async () => {
    mocks.getPageByPath.mockResolvedValue({ id: 2, is_admin_only: "NO" });
    const response = await renderRssFeedResponse({
      scope: { type: "page", pagePath: "public" },
      feedPath: "/public/rss.xml",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<rss");
    expect(mocks.getPageMonitorsExcludeHidden).toHaveBeenCalledWith(2);
  });
});
