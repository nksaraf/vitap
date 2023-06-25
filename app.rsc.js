import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import serverComponent from "react-server-dom-vite/plugin";

import { createApp } from "./lib/app.js";
import { client } from "./lib/app-client-plugin.js";
import { readFileSync } from "fs";
import { getEntries } from "./lib/router/node-handler.js";
// process.env.NODE_ENV = "production";

function serverComponents() {
  const serverModules = new Set();
  const clientModules = new Set();
  return [
    serverComponent({
      hash,
      onServerReference(reference) {
        serverModules.add(reference);
      },
      onClientReference(reference) {
        clientModules.add(reference);
      },
    }),
    react(),
    {
      name: "react-rsc",
      handleHotUpdate({ file }) {
        // clear vite module cache so when its imported again, we will
        // fetch(`http://localhost:3000/__refresh`, {
        //   method: 'POST',
        //   headers: {'Content-Type': 'application/json'},
        //   body: JSON.stringify({file}),
        // })
        //   .then(() => {})
        //   .catch(err => console.error(err));
      },
      config(inlineConfig, env) {
        if (env.command === "build") {
          return {
            resolve: {
              conditions: [
                "node",
                "import",
                "react-server",
                process.env.NODE_ENV,
              ],
            },
            ssr: {
              noExternal: true,
            },
          };
        } else {
          return {
            resolve: {
              conditions: [
                "node",
                "import",
                "react-server",
                process.env.NODE_ENV,
              ],
            },
            ssr: {
              noExternal: true,
              external: ["react", "react-dom", "react-server-dom-vite"],
            },
          };
        }
      },
      generateBundle() {
        this.emitFile({
          fileName: "react-server-manifest.json",
          type: "asset",
          source: JSON.stringify({
            server: [...serverModules],
            client: [...clientModules],
          }),
        });
      },
    },
  ];
}

function hash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }

  return hash;
}

/**
 *
 * @returns {import('vite').Plugin}
 */
function clientComponents() {
  let isBuild;
  let input;
  return {
    name: "client-components",
    config(config, env) {
      isBuild = env.command === "build";
      // @ts-ignore
      const router = config.router;

      if (isBuild) {
        const reactServerManifest = JSON.parse(
          readFileSync(".build/rsc/_rsc/react-server-manifest.json", "utf-8")
        );

        input = {
          entry: getEntries(router)[0],
          ...Object.fromEntries(
            reactServerManifest.client.map((key) => {
              return [hash(key), key];
            })
          ),
        };

        return {
          ssr: {
            external: ["react", "react-dom", "react-server-dom-vite"],
          },
          build: {
            rollupOptions: {
              // preserve the export names of the server actions in chunks
              treeshake: true,
              // required otherwise rollup will remove the exports since they are not used
              // by the other entries
              preserveEntrySignatures: "exports-only",
              // manualChunks: (chunk) => {
              //   // server references should be emitted as separate chunks
              //   // so that we can load them individually when server actions
              //   // are called. we need to do this in manualChunks because we don't
              //   // want to run a preanalysis pass just to identify these
              //   // if (serverModules.has(chunk)) {
              //   //   return `${hash(chunk)}`;
              //   // }
              // },
              // we want to control the chunk names so that we can load them
              // individually when server actions are called
              // chunkFileNames: "[name].js",
              output: {
                minifyInternalExports: false,
                entryFileNames: (chunk) => {
                  return chunk.name + ".js";
                },
              },
            },
          },
        };
      } else {
        return {
          ssr: {
            external: ["react", "react-dom", "react-server-dom-vite"],
          },
        };
      }
    },

    configResolved(config) {
      console.log(config.build.rollupOptions);
      if (isBuild) {
        const reactServerManifest = JSON.parse(
          readFileSync(".build/rsc/_rsc/react-server-manifest.json", "utf-8")
        );
        config.build.rollupOptions.input = input;
        console.log(config.build.rollupOptions);
      }
    },
  };
}

const app = createApp({
  bundlers: [
    {
      name: "static-server",
      outDir: "./.build/client",
    },
    {
      name: "react-rsc",
      target: "node",
      outDir: "./.build/rsc",
      worker: true,
      plugins: () => [serverComponents()],
    },
    {
      name: "react-rsc-ssr",
      target: "node",
      outDir: "./.build/rsc",
      plugins: () => [react(), clientComponents()],
    },
    {
      name: "react-rsc-client",
      target: "browser",
      outDir: "./.build/rsc",
      plugins: () => [react(), clientComponents()],
    },
  ],
  routers: [
    {
      mode: "static",
      dir: "./public",
      name: "public-dir",
      build: "static-server",
      prefix: "/",
    },
    {
      name: "react-rsc",
      mode: "node-handler",
      handler: "./rsc/react-server.tsx",
      build: "react-rsc",
      prefix: "/_rsc",
    },
    {
      name: "react-rsc-client",
      mode: "build",
      handler: "./rsc/client.tsx",
      build: "react-rsc-client",
      prefix: "/_rsc_pages",
    },
    {
      name: "react-rsc-ssr",
      mode: "node-handler",
      handler: "./rsc/ssr-server.tsx",
      build: "react-rsc-ssr",
      prefix: "/",
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
