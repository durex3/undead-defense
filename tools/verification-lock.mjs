import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const tokenName = "UNDEAD_VERIFICATION_TOKEN";
export const lockFile = path.resolve("temp/verification.lock");
/** Fail fast rather than delete or rebuild another check's shared output directory. */
export async function withVerificationLock(
  action,
  {
    file = lockFile,
    env = process.env,
    command = process.argv.slice(1).join(" "),
  } = {},
) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };
  const parent = read();
  if (parent && env[tokenName] === parent.token) {
    try {
      process.kill(parent.pid, 0);
    } catch {
      throw Error("检查锁所属进程已经退出，不能继承失效的检查上下文");
    }
    return action({ ...env });
  }
  const owner = {
    pid: process.pid,
    token: randomUUID(),
    command,
    startedAt: new Date().toISOString(),
  };
  let fd;
  try {
    fd = fs.openSync(file, "wx");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const active = read();
    throw Error(
      `已有检查占用共享目录：PID ${active?.pid ?? "未知"}，${active?.command ?? "正在创建检查锁"}。本次未运行。锁文件：${file}`,
    );
  }
  try {
    fs.writeFileSync(fd, JSON.stringify(owner));
  } catch (e) {
    fs.closeSync(fd);
    fs.unlinkSync(file);
    throw e;
  }
  fs.closeSync(fd);
  const release = () => {
    if (read()?.token === owner.token) fs.unlinkSync(file);
  };
  process.once("exit", release);
  try {
    return await action({ ...env, [tokenName]: owner.token });
  } finally {
    process.removeListener("exit", release);
    release();
  }
}
