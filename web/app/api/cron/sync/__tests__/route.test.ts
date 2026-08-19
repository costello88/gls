import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/automation/run", () => ({
  runAutomatedSync: vi.fn(),
}));

import { runAutomatedSync } from "../../../../../lib/automation/run";
import { handleCronSync } from "../shared";

const mockedRunAutomatedSync = vi.mocked(runAutomatedSync);

describe("handleCronSync", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when the Authorization header doesn't match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("https://example.com/api/cron/sync", {
      headers: { Authorization: "Bearer wrong" },
    });

    const response = await handleCronSync(request, {} as any, {} as any);

    expect(response.status).toBe(401);
    expect(mockedRunAutomatedSync).not.toHaveBeenCalled();
  });

  it("runs automation and returns results when the secret matches", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockedRunAutomatedSync.mockResolvedValue({
      stores: [{ storeId: "store-1", sync: { new: 1, valid: 1, invalid: 0, ignored: 0 } }],
      deletedOldOrders: 2,
    });
    const request = new Request("https://example.com/api/cron/sync", {
      headers: { Authorization: "Bearer test-secret" },
    });

    const response = await handleCronSync(request, {} as any, {} as any);
    const body = (await response.json()) as { stores: unknown[]; deletedOldOrders: number };

    expect(response.status).toBe(200);
    expect(body.stores).toHaveLength(1);
    expect(body.deletedOldOrders).toBe(2);
  });
});
