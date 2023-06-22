import { pathToRegexp } from "path-to-regexp";
import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { Route, Router } from "wouter";
import makeCachedMatcher from "wouter/matcher";

import manifest from "./lib/client-manifest";
import getRoutes from "./lib/react/routes";
import App from "./ssr-app";

const convertPathToRegexp = (path) => {
	let keys = [];

	// we use original pathToRegexp package here with keys
	const regexp = pathToRegexp(path, keys, { strict: true });
	return { keys, regexp };
};

const customMatcher = makeCachedMatcher(convertPathToRegexp);
let routes = getRoutes(manifest["react-rsc-client"]);

ReactDOM.hydrateRoot(
	document,
	<App>
		<Router matcher={customMatcher} base={(window as any).base}>
			{routes.map((route) => (
				<Route path={route.path} key={route.path} component={route.component} />
			))}
		</Router>
	</App>,
);
