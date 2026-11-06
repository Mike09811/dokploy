import type { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	connections: [] as Array<Record<string, unknown>>,
	commands: [] as string[],
	failPassword: false,
	failKey: false,
	failWrite: false,
}));

vi.mock("ssh2", async () => {
	const { EventEmitter } = await import("node:events");
	return {
	Client: class extends EventEmitter {
		connect(config: Record<string, unknown>) {
			state.connections.push(config);
			queueMicrotask(() => {
				if ((config.password && state.failPassword) || (config.privateKey && state.failKey)) {
					this.emit("error", new Error("authentication failed"));
				} else {
					this.emit("ready");
				}
			});
			return this;
		}
		exec(command: string, callback: (error: null, stream: EventEmitter & { stderr: { resume: () => void }; resume: () => void }) => void) {
			state.commands.push(command);
			const stream = Object.assign(new EventEmitter(), { stderr: { resume() {} }, resume() {} });
			callback(null, stream);
			queueMicrotask(() => stream.emit("close", state.failWrite && state.commands.length === 1 ? 1 : 0));
		}
		end() {}
	},
	};
});

import { installServerKey } from "../../server/utils/password-server-setup";

const input = { ipAddress: "192.0.2.1", port: 22, password: "secret", publicKey: "ssh-ed25519 AAAA dokploy", privateKey: "private" };

beforeEach(() => {
	state.connections = [];
	state.commands = [];
	state.failPassword = false;
	state.failKey = false;
	state.failWrite = false;
});

describe("server password setup", () => {
	it("installs a key and verifies a new key-only connection", async () => {
		await installServerKey(input);
		expect(state.connections).toHaveLength(2);
		expect(state.connections[0]).toMatchObject({ username: "root", password: "secret" });
		expect(state.connections[1]).toMatchObject({ username: "root", privateKey: "private" });
		expect(state.connections[1]).not.toHaveProperty("password");
		expect(state.commands[0]).toContain("authorized_keys");
		expect(state.commands[0]).not.toContain(input.password);
	});

	it("does not install a key when password authentication fails", async () => {
		state.failPassword = true;
		await expect(installServerKey(input)).rejects.toThrow("SSH 连接失败");
		expect(state.commands).toHaveLength(0);
	});

	it("removes the generated key if key authentication fails", async () => {
		state.failKey = true;
		await expect(installServerKey(input)).rejects.toThrow("SSH 连接失败");
		expect(state.commands).toHaveLength(2);
		expect(state.commands[1]).toContain("grep -Fvx");
	});

	it("fails if the remote key cannot be written", async () => {
		state.failWrite = true;
		await expect(installServerKey(input)).rejects.toThrow("SSH 连接失败");
		expect(state.connections).toHaveLength(1);
	});
});
