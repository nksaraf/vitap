/** @jsxImportSource solid-js */
import { MetaProvider } from "@solidjs/meta";
import { Route, Router, Routes } from "@solidjs/router";
import { NoHydration, Suspense, hydrate, render } from "solid-js/web";

import manifest from "../lib/client-manifest";
import getRoutes from "../lib/solid/routes";
import App from "./ssr-app";

const routes = getRoutes(manifest["solid-nested-client"]).map((route) => ({
	path: route.path,
	component: route.component,
}));

const FileRoutes = () => {
	return routes as any;
};
hydrate(
	() => (
		<MetaProvider>
			<Router base={(window as any).base}>
				<App>
					{/* <Meta />
					<HydrationScript />
					{...assets.map(({ tag, key, ...props }) =>
						createComponent(assetMap[tag], props),
					)} */}
					<NoHydration></NoHydration>
					<Suspense>
						<Routes>
							<FileRoutes />
						</Routes>
					</Suspense>
				</App>
			</Router>
		</MetaProvider>

		// <App>
		// 	<MetaProvider>
		// 		<Router base={import.meta.env.BASE_URL}>
		// 			<Routes>
		// 				{routes.map((route) => (
		// 					<Route path={route.path} component={route.component} />
		// 				))}
		// 			</Routes>
		// 		</Router>
		// 	</MetaProvider>
		// </App>
	),
	document,
);
