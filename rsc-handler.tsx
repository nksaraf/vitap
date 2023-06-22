import React from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { Router } from "wouter";

import lazyRoute from "./lib/react/lazy-route";
import type { HandlerContext } from "./lib/types";
import App from "./ssr-app";
import * as ReactServerDOM from "react-server-dom-vite/server";

export default async (event, context: HandlerContext) => {
  const { manifest } = context;

  // if (!context.match) {
  // 	throw new Error(`Path ${event.request.url} did not match any route`);
  // }

  // const Route = lazyRoute(
  // 	context.match.filePath,
  // 	manifest["react-rsc-client"],
  // 	manifest[context.router.name],
  // );

  // const manifestJSON = await manifest["react-rsc-client"].json();
  // const assets = await manifest["react-rsc-client"]?.inputs[
  //   "rsc-ssr-client.tsx"
  // ].assets();

  // const htmlStream = await renderToReadableStream(
  //   <App>
  //     {assets.map(({ tag: Tag, key, ...props }) => (
  //       <Tag key={key} {...props} />
  //     ))}
  //     {/* <Router
  // 			ssrPath={new URL(event.request.url).pathname}
  // 			base={import.meta.env.BASE_URL}
  // 		>
  // 			<Route />
  // 		</Router> */}
  //   </App>,
  //   {
  //     bootstrapModules: [
  //       manifest["react-rsc-client"]?.inputs["./rsc-ssr-client.tsx"].output
  //         .path,
  //     ].filter(Boolean) as string[],
  //     bootstrapScriptContent: `
  // 		window.base = "${import.meta.env.BASE_URL}"
  // 		window.manifest = ${JSON.stringify(manifestJSON)};`,
  //   }
  // );

  return ReactServerDOM.renderToPipeableStream(
    <App>
      <div>Hello World</div>
    </App>
  );
};
