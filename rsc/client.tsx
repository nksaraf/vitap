// import { pathToRegexp } from "path-to-regexp";
import React, { lazy, startTransition } from "react";
import ReactDOM from "react-dom/client";
import { ServerComponent } from "../server-component";

import { createModuleLoader } from "react-server-dom-vite/runtime";
globalThis.__vite__ = createModuleLoader({
  loadModule: async (id) => {
    if (import.meta.env.DEV) {
    let moduleId = `${import.meta.env.BASE_URL}/@fs${id}`;
    return import(/* @vite-ignore */ moduleId);
  }
  else {
    return import(/* @vite-ignore */ `${import.meta.env.BASE_URL}/${id}.js`)
  }
},
});
// import { Route, Router } from "wouter";
// import makeCachedMatcher from "wouter/matcher";

// import manifest from "./lib/client-manifest";
// import getRoutes from "./lib/react/routes";
// import App from "./ssr-app";

// const convertPathToRegexp = (path) => {
// 	let keys = [];

// 	// we use original pathToRegexp package here with keys
// 	const regexp = pathToRegexp(path, keys, { strict: true });
// 	return { keys, regexp };
// };

// const customMatcher = makeCachedMatcher(convertPathToRegexp);
// let routes = getRoutes(manifest["react-rsc-client"]);

// ReactDOM.hydrateRoot(
// 	document,
// 	<App>
// 		<Router matcher={customMatcher} base={(window as any).base}>
// 			{routes.map((route) => (
// 				<Route path={route.path} key={route.path} component={route.component} />
// 			))}
// 		</Router>
// 	</App>,
// );

startTransition(() => {
  ReactDOM.hydrateRoot(
    document,
    <ServerComponent url={window.location.pathname} />
  );
});
