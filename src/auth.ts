import { Client, StorageLocalStorage } from "mtkruto/mod.ts";
import { config } from "./config.ts";

const client = new Client(new StorageLocalStorage("key"), config.telegram.id, config.telegram.hash);

await client.authorize({
  phone: () => prompt("Phone") || "",
  code: () => prompt("Code") || "",
  password: () => prompt("Password") || "",
})

client.exportAuthString().then(console.log).catch(console.error);