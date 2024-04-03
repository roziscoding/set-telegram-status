import { Client, StorageMemory, types } from "mtkruto/mod.ts";
import { config } from "./config.ts";

const kv = await Deno.openKv(config.kv.path);

const getClient = () => {
  return new Client(
    new StorageMemory(config.session),
    config.telegram.id,
    config.telegram.hash,
  );
};

const makeResponse = ({ status = 200, body = undefined }: { status?: number; body?: unknown }) =>
  new Response(
    JSON.stringify(body),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );

const isValidSecret = (req: Request, secret: string | undefined) => {
  if (!secret) return true;
  const header = req.headers.get("Authorization");
  return header === secret;
};

const isValidRequest = (req: Request) => {
  const url = new URL(req.url);
  if (req.method !== "POST") return false;
  if (!url.pathname.endsWith("/status")) return false;
  return true;
};

const setStatus = async (client: Client, emojiId: string, manageLock = true) => {
  if (manageLock) await kv.set(["LOCKED"], true);

  try {
    await client.api.account.updateEmojiStatus({
      emoji_status: new types.EmojiStatus({ document_id: BigInt(emojiId) }),
    });

    return new Response();
  } catch (err) {
    return makeResponse({ status: 500, body: { error: err.message } });
  } finally {
    if (manageLock) await kv.set(["LOCKED"], false);
  }
};

const processRequest = async (req: Request) => {
  try {
    if (!isValidSecret(req, config.secret)) {
      return makeResponse({ status: 401, body: { error: "Unauthorized" } });
    }
    if (!isValidRequest(req)) {
      return makeResponse({ status: 400, body: { error: "Invalid request" } });
    }

    const url = new URL(req.url);
    const emojiId = url.searchParams.get("emojiId");

    if (!emojiId) {
      return makeResponse({ status: 400, body: { error: "Invalid request. Missing emojiId param." } });
    }

    const locked = await kv.get(["LOCKED"]);

    if (locked.value) {
      await kv.set(["pending", crypto.randomUUID()], { emojiId });
      return makeResponse({ status: 202 });
    }

    const client = getClient();

    await client.start();

    const response = await setStatus(client, emojiId);

    await client.disconnect();

    return response
  } catch (err) {
    return makeResponse({ status: 500, body: { error: err.message ?? err } });
  }
}

Deno.serve(async (req) => {
  const timeStart = Date.now();
  const response = await processRequest(req)
  const timeEnd = Date.now();

  console.log(`[${req.method}] ${req.url} - ${response.status} - ${timeEnd - timeStart}ms`);
  
  return response;
});

const lockStatus = await kv.watch([["LOCKED"]]);

for await (const [status] of lockStatus) {
  if (typeof status.value !== "boolean") continue;
  if (status.value) continue;

  console.log("Lock has been released. Looking for pending operations.");

  const pendingOps = await kv.list<{ emojiId: string }>({ prefix: ["pending"] });
  const pending: Array<{ key: Deno.KvKey; value: { emojiId: string } }> = [];

  for await (const { key, value } of pendingOps) {
    pending.push({ key, value });
  }

  if (!pending.length) {
    console.log("No pending operations found.");
    continue;
  }

  console.log(`Processing ${pending.length} pending operations`);

  const client = getClient();

  try {
    await client.start();
  } catch (err) {
    console.error(err);
    await client.disconnect();
    continue;
  }

  await kv.set(["LOCKED"], true);

  for (const { key, value } of pending) {
    console.log(`Processing pending operation: ${key.toString().split(",").pop()}`);
    await kv.delete(key);
    await setStatus(client, value.emojiId, false);
  }

  await client.disconnect();
  await kv.set(["LOCKED"], false);
}
