import { afterEach, describe, expect, it, vi } from "vitest";
import { getGhcrDigest } from "@dokploy/server/services/ghcr";

afterEach(() => vi.unstubAllGlobals());

describe("GitHub 容器镜像", () => {
	it("获取指定镜像标签的摘要", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ token: "token" })))
			.mockResolvedValueOnce(new Response(null, { headers: { "docker-content-digest": "sha256:123" } }));
		vi.stubGlobal("fetch", fetchMock);
		expect(await getGhcrDigest("latest", 1000)).toBe("sha256:123");
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain("repository%3Amike09811%2Fdokploy%3Apull");
		expect(fetchMock.mock.calls[1]?.[0]).toBe("https://ghcr.io/v2/mike09811/dokploy/manifests/latest");
		expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "HEAD", headers: { Authorization: "Bearer token" } });
	});

	it("镜像不可访问时返回错误", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
		await expect(getGhcrDigest("latest", 1000)).rejects.toThrow();
	});
});
