import React from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { Router } from "wouter";

import lazyRoute from "./lib/react/lazy-route";
import type { HandlerContext } from "./lib/types";
import App from "./ssr-app";
import * as ReactServerDOM from "react-server-dom-vite/client";
import { Readable } from "node:stream";
import consumers from "node:stream/consumers";
console.log(ReactServerDOM);
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

  const manifestJSON = await manifest["react-rsc-client"].json();
  const assets = await manifest["react-rsc-client"]?.inputs[
    "rsc-ssr-client.tsx"
  ].assets();

  const htmlStream = await renderToReadableStream(
    ReactServerDOM.createFromNodeStream(
      await context.fetchNode(request, context)
    ),
    {
      bootstrapModules: [
        manifest["react-rsc-client"]?.inputs["./rsc-ssr-client.tsx"].output
          .path,
      ].filter(Boolean) as string[],
      bootstrapScriptContent: `
			window.base = "${import.meta.env.BASE_URL}";
			window.manifest = ${JSON.stringify(manifestJSON)};`,
    }
  );

  return new Response(htmlStream, {
    headers: {
      "content-type": "text/html",
    },
  });
};
