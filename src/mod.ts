import { Client, StorageMemory, types } from "mtkruto/mod.ts";
import { config } from "./config.ts";

const client = new Client(
  new StorageMemory(config.session),
  config.api.id,
  config.api.hash,
);

await client.start();

const FOCUS_TO_EMOJI_ID = {
  work: "5418063924933173277",
  sleep: "5451959871257713464",
  drive: "5445085952194124000",
  doNotDisturb: "5332296662142434561",
  none: "5276020560361432449",
};

const makeResponse = ({ status = 200, body = undefined }: { status?: number; body?: unknown }) =>
  new Response(
    JSON.stringify(body),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );

const isVaildStatus = (status: string | undefined): status is keyof typeof FOCUS_TO_EMOJI_ID =>
  (status ?? "") in FOCUS_TO_EMOJI_ID;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method !== "POST") return makeResponse({ status: 405, body: { error: `Invalid method: ${req.method}` } });
  if (!url.pathname.startsWith("/status/")) return makeResponse({ status: 404 });
  const status = url.pathname.split("/").pop();

  if (!isVaildStatus(status)) {
    return makeResponse({ status: 400, body: { error: `Invalid status: ${status}` } });
  }

  const emojiId = FOCUS_TO_EMOJI_ID[status];

  await client.api.account.updateEmojiStatus({
    emoji_status: new types.EmojiStatus({ document_id: BigInt(emojiId) }),
  });

  return new Response();
});
