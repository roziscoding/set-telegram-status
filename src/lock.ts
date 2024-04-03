import { config } from "./config.ts";

const [lockString] = Deno.args;
const kv = await Deno.openKv(config.kv.path);

const lock = lockString === "true"
  ? true
  : lockString === "false"
  ? false
  : await kv.get(["LOCKED"]).then(({value}) => !value);

await kv.set(["LOCKED"], lock);

console.log(`${lock ? "Locked" : "Unlocked"}`);

await kv.close();
