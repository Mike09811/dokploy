import { quote } from "shell-quote";
import { Client } from "ssh2";

export async function installServerKey(input: {
	ipAddress: string;
	port: number;
	password: string;
	publicKey: string;
	privateKey: string;
}) {
	const connection = new Client();
	const config = {
		host: input.ipAddress,
		port: input.port,
		username: "root",
		readyTimeout: 20000,
	};
	const connect = (
		client: Client,
		auth: { password: string } | { privateKey: string },
	) =>
		new Promise<void>((resolve, reject) => {
			client.once("ready", resolve).once("error", reject).connect({
				...config,
				...auth,
			});
		});
	const run = (command: string) =>
		new Promise<void>((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(timer);
				connection.removeListener("close", onClose);
				if (error) reject(error);
				else resolve();
			};
			const onClose = () => finish(new Error("SSH connection closed"));
			const timer = setTimeout(() => finish(new Error("SSH command timed out")), 20000);
			connection.once("close", onClose);
			connection.exec(command, (error, stream) => {
				if (error) return finish(error);
				stream.once("error", finish);
				stream.on("close", (code: number | null) =>
					finish(code === 0 ? undefined : new Error("SSH command failed")),
				);
				stream.stderr.resume();
				stream.resume();
			});
		});
	let installed = false;
	try {
		await connect(connection, { password: input.password });
		const key = quote([input.publicKey.trim()]);
		await run(`umask 077; mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && printf '\\n%s\\n' ${key} >> ~/.ssh/authorized_keys`);
		installed = true;
		const verification = new Client();
		try {
			await connect(verification, { privateKey: input.privateKey });
		} finally {
			verification.end();
		}
	} catch {
		if (installed) {
			const key = quote([input.publicKey.trim()]);
			await run(`tmp=$(mktemp ~/.ssh/authorized_keys.XXXXXX) && { grep -Fvx -- ${key} ~/.ssh/authorized_keys > "$tmp"; result=$?; [ "$result" -le 1 ]; } && cat "$tmp" > ~/.ssh/authorized_keys; rm -f "$tmp"`).catch(() => {});
		}
		throw new Error("SSH 连接失败，请检查 root 密码、网络及服务器的密码和公钥登录设置");
	} finally {
		connection.end();
	}
}
