import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { Router } from "wouter";

import lazyRoute from "./lib/react/lazy-route";
import App from "./ssr-app";
import type { HandlerContext } from "./types";

export default async (request, response, context: HandlerContext) => {
	const { manifest } = context;

	if (!context.match) {
		throw new Error(`Path ${request.url} did not match any route`);
	}

	const Route = lazyRoute(
		context.match.filePath,
		manifest["react-client"],
		manifest["react-ssr"],
	);

	const manifestJSON = await manifest["react-client"].json();

	const { pipe } = renderToPipeableStream(
		<App>
			<Router ssrPath={request.url} base={import.meta.env.BASE_URL}>
				<Route />
			</Router>
		</App>,
		{
			bootstrapModules: [
				manifest["react-client"]?.inputs["./ssr-client.tsx"].output.path,
			].filter(Boolean) as string[],
			bootstrapScriptContent: `window.manifest = ${JSON.stringify(
				manifestJSON,
			)}; window.base = "${import.meta.env.BASE_URL}";`,
			onShellReady() {
				response.setHeader("content-type", "text/html");
				pipe(response);
			},
		},
	);
};
