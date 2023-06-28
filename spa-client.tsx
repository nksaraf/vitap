import { pathToRegexp } from "path-to-regexp";
import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { Route, Router } from "wouter";
import makeCachedMatcher from "wouter/matcher";

import manifest from "./lib/manifest/client-manifest";
import getRoutes from "./lib/react/routes";
import App from "./spa-app";

/*
 * This function specifies how strings like /app/:users/:items* are
 * transformed into regular expressions.
 *
 * Note: it is just a wrapper around `pathToRegexp`, which uses a
 * slightly different convention of returning the array of keys.
 *
 * @param {string} path — a path like "/:foo/:bar"
 * @return {{ keys: [], regexp: RegExp }}
 */
const convertPathToRegexp = (path) => {
  let keys = [];

  // we use original pathToRegexp package here with keys
  const regexp = pathToRegexp(path, keys, { strict: true });
  return { keys, regexp };
};

const customMatcher = makeCachedMatcher(convertPathToRegexp);
let routes = getRoutes(manifest["react-spa"]);
ReactDOM.createRoot(document.getElementById("app")!).render(
  <App>
    <Router
      matcher={customMatcher}
      base={
        import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL
      }
    >
      {routes.map((route) => (
        <Route path={route.path} key={route.path} component={route.component} />
      ))}
    </Router>
  </App>
);
