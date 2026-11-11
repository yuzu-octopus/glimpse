import { describe, expect, it } from "vitest";
import { aiQuotaSchema } from "./ai-quota";

describe("ai-quota schema", () => {
	it("accepts a provider and takes no token", () => {
		const cfg = aiQuotaSchema.parse({ type: "ai-quota", provider: "codex" });
		expect(cfg.provider).toBe("codex");
		// Stripped, not passed through: the config is handed to the browser whole.
		const withToken = aiQuotaSchema.parse({ type: "ai-quota", provider: "codex", token: "leaked" });
		expect("token" in withToken).toBe(false);
		expect(JSON.stringify(withToken)).not.toContain("leaked");
	});
	it("accepts accountId for the Codex multi-account header", () => {
		const cfg = aiQuotaSchema.parse({ type: "ai-quota", provider: "codex", accountId: "acc-1" });
		expect(cfg.accountId).toBe("acc-1");
	});
	it("rejects unknown provider", () => {
		expect(() => aiQuotaSchema.parse({ type: "ai-quota", provider: "bad" as never })).toThrow();
	});
});
