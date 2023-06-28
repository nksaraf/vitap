import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { Router } from "wouter";

import lazyRoute from "../lib/react/lazy-route";
import type { HandlerContext } from "../lib/types";
import App from "../ssr-app";
import * as ReactServerDOM from "react-server-dom-vite/client";
import { createModuleLoader } from "react-server-dom-vite/runtime";
import { Writable, Readable } from "node:stream";
export default async (request, response, context: HandlerContext) => {
  const { manifest } = context;

  // if (!context.match) {
  // 	throw new Error(`Path ${event.request.url} did not match any route`);
  // }

  // const Route = lazyRoute(
  // 	context.match.filePath,
  // 	manifest["react-rsc-client"],
  // 	manifest[context.router.name],
  // );

  globalThis.__vite__ = createModuleLoader(
    import.meta.env.DEV
      ? context.router.devServer
      : {
          loadModule: async (id) => {
            let moduleId = manifest["react-rsc-ssr"].chunks[id].output.path;
            return import(/* @vite-ignore */ moduleId);
          },
        }
  );

  const readable = new Readable({
    objectMode: true,
  });
  readable._read = () => {};
  readable.headers = {};

  const writableStream = new Writable({
    write(chunk, encoding, callback) {
      readable.push(chunk);
      callback();
    },
  });
  writableStream.setHeader = () => {};

  writableStream.on("finish", () => {
    readable.push(null);
    readable.destroy();
  });

  request.url = `/_rsc` + request.url;

  await context.fetchNode(request, writableStream);

  const clientManifest = manifest["react-rsc-client"];

  const { pipe } = await renderToPipeableStream(
    await ReactServerDOM.createFromNodeStream(readable),
    {
      bootstrapModules: [
        clientManifest?.inputs[clientManifest.handler].output.path,
      ].filter(Boolean) as string[],
      bootstrapScriptContent: `window.base = "${import.meta.env.BASE_URL}";`,
    }
  );

  pipe(response);
};
