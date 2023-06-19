/** @jsxImportSource solid-js */
import { MetaProvider } from "@solidjs/meta";
import { Route, Router, Routes } from "@solidjs/router";
import { render } from "solid-js/web";

import manifest from "../lib/client-manifest";
import getRoutes from "../lib/solid/routes";
import { App } from "./App";

let routes = getRoutes(manifest["solid-spa"]);

render(
	() => (
		<App>
			<MetaProvider>
				<Router base={import.meta.env.BASE_URL}>
					<Routes>
						{routes.map((route) => (
							<Route path={route.path} component={route.component} />
						))}
					</Routes>
				</Router>
			</MetaProvider>
		</App>
	),
	document.getElementById("app")!,
);
