import { createApp } from "./lib/app.js";

const app = createApp({
  bundlers: [
    {
      name: "static-server",
      outDir: "./.build/client",
    },
    {
      name: "node-api",
      target: "node",
      outDir: "./.build/api",
    },
  ],
  routers: [
    {
      mode: "node-handler",
      handler: "./api-handler.tsx",
      name: "api",
      build: "node-api",
    },
  ],
});

console.log(app.config);

if (process.argv.includes("--build")) {
  await app.build();
}

if (process.argv.includes("--serve") || process.argv.includes("--dev")) {
  await app.serve({
    port: 3000,
    dev: process.argv.includes("--dev"),
  });
}

export default app;
