import React from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { Router } from "wouter";

import lazyRoute from "./lib/react/lazy-route";
import App from "./ssr-app";
import type { HandlerContext } from "./types";

export default async (event, context: HandlerContext) => {
	const { manifest } = context;

	if (!context.match) {
		throw new Error(`Path ${event.request.url} did not match any route`);
	}

	const Route = lazyRoute(
		context.match.filePath,
		manifest["react-client"],
		manifest["react-ssr-web"],
	);

	const manifestJSON = await manifest["react-client"].json();

	const htmlStream = await renderToReadableStream(
		<App>
			<Router
				ssrPath={new URL(event.request.url).pathname}
				base={context.prefix}
			>
				<Route />
			</Router>
		</App>,
		{
			bootstrapModules: [
				manifest["react-client"]?.inputs["./ssr-client.tsx"].output.path,
			].filter(Boolean) as string[],
			bootstrapScriptContent: `
			window.base = "${context.prefix}"
			window.manifest = ${JSON.stringify(manifestJSON)};`,
		},
	);

	return new Response(htmlStream, {
		headers: {
			"content-type": "text/html",
		},
	});
};
