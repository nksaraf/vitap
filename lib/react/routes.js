import routeConfig from "../route-config";
import lazyRoute from "./lazy-route";

/**
 *
 * @returns {{ path: string; filePath: string, component: () => JSX.Element }[]}
 */
export default function loadRoutes(clientManifest, serverManifest = undefined) {
	return routeConfig.map((route) => {
		route.component = lazyRoute(
			route.component,
			clientManifest,
			serverManifest,
		);
		return route;
	});
}
