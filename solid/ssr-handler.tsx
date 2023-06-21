/** @jsxImportSource solid-js */
import { Link, MetaProvider, Style, renderTags } from "@solidjs/meta";
import { Route, Router, Routes, useRoutes } from "@solidjs/router";
import { join } from "pathe";
import {
	Assets,
	HydrationScript,
	NoHydration,
	Suspense,
	createComponent,
	renderToStream,
	renderToStringAsync,
	ssr,
	useAssets,
} from "solid-js/web";

import { Readable, promises } from "node:stream";

import lazyRoute from "../lib/solid/lazy-route";
import type { HandlerContext } from "../lib/types";
import App from "./ssr-app";

const assetMap = {
	style: Style,
	link: Link,
	script: (props) => {
		return <script {...props}></script>;
	},
};

export default async (request, response, context: HandlerContext) => {
	const { manifest } = context;

	if (!context.match) {
		throw new Error(`Path ${request.url} did not match any route`);
	}

	const RouteComponent = lazyRoute(
		context.match.filePath,
		manifest["solid-client"],
		manifest[context.router.name],
	);

	const manifestJSON = await manifest["solid-client"].json();

	const assets = await manifest["solid-client"]?.inputs[
		"./solid/ssr-client.tsx"
	].assets();

	console.log(request.url, import.meta.env.BASE_URL);
	const tags = [];

	function Meta() {
		useAssets(() => ssr(renderTags(tags)));
		return null;
	}

	console.log(context.router.fileRouter);

	const routes = context.router.fileRouter.routes.map((route) => ({
		path: route.path,
		component: lazyRoute(
			route.filePath,
			manifest["solid-client"],
			manifest[context.router.name],
		),
	}));

	const FileRoutes = () => {
		return routes;
	};

	const html = await renderToStringAsync(
		() => (
			<MetaProvider tags={tags}>
				<Router
					out={{}}
					url={join(import.meta.env.BASE_URL, request.url)}
					base={import.meta.env.BASE_URL}
				>
					<App>
						<NoHydration>
							<Meta />
							{...assets.map(({ tag, key, ...props }) =>
								createComponent(assetMap[tag], props),
							)}
							<HydrationScript />
							<script
								type="module"
								async
								src={
									manifest["solid-client"]?.inputs["./solid/ssr-client.tsx"]
										.output.path
								}
								$ServerOnly
							></script>
							<script
								innerHTML={`window.base="${
									import.meta.env.BASE_URL
								}";window.manifest=${JSON.stringify(manifestJSON)}`}
							/>
						</NoHydration>

						<Suspense>
							<Routes>
								<FileRoutes />
							</Routes>
						</Suspense>
					</App>
				</Router>
			</MetaProvider>
		),
		// {
		// 	bootstrapModules: [
		// 		manifest["react-client"]?.inputs["./ssr-client.tsx"].output.path,
		// 	].filter(Boolean) as string[],
		// 	bootstrapScriptContent: `window.manifest = ${JSON.stringify(
		// 		manifestJSON,
		// 	)}; window.base = "${import.meta.env.BASE_URL}";`,
		// 	onShellReady() {
		// 		response.setHeader("content-type", "text/html");
		// 		pipe(response);
		// 	},
		// },
	);

	console.log(html);
	// stream.pipe(response);
	response.write(html);
	response.end();
};
