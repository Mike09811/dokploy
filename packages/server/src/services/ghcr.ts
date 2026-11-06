const repository = "mike09811/dokploy";

export async function getGhcrDigest(tag: string, timeoutMs: number) {
	const signal = AbortSignal.timeout(timeoutMs);
	const tokenUrl = new URL("https://ghcr.io/token");
	tokenUrl.searchParams.set("scope", `repository:${repository}:pull`);
	const tokenResponse = await fetch(tokenUrl, { signal });
	if (!tokenResponse.ok) throw new Error("镜像仓库认证失败");
	const { token } = (await tokenResponse.json()) as { token?: string };
	if (!token) throw new Error("镜像仓库未返回访问令牌");

	const response = await fetch(
		`https://ghcr.io/v2/${repository}/manifests/${encodeURIComponent(tag)}`,
		{
			method: "HEAD",
			signal,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: [
					"application/vnd.oci.image.index.v1+json",
					"application/vnd.docker.distribution.manifest.list.v2+json",
					"application/vnd.oci.image.manifest.v1+json",
					"application/vnd.docker.distribution.manifest.v2+json",
				].join(", "),
			},
		},
	);
	if (!response.ok) throw new Error("无法检查镜像版本");
	const digest = response.headers.get("docker-content-digest");
	if (!digest) throw new Error("镜像仓库未返回摘要");
	return digest;
}
