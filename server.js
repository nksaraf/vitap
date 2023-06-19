import react from "@vitejs/plugin-react";
import connect from "connect";
import fs from "fs";
import { createServer } from "http";
import { dirname, isAbsolute, join, relative } from "pathe";
import serveStatic from "serve-static";
import solid from "vite-plugin-solid";

import { FileSystemRouter } from "./FileSystemRouter.js";
import findAssetsInManifest from "./lib/assets-manifest.js";
import collectStyles from "./lib/collect-styles.js";
import invariant from "./lib/invariant.js";
import { handleNodeRequest } from "./lib/node-web-server.js";
import { buildManifest } from "./lib/spa-manifest.js";

/**
 *
 * @param {import("vite").InlineConfig & { router: import("./types.d.ts").RouterConfig; bundler: import("./types.d.ts").BundlerConfig}} config
 */
async function createDevServer(config) {
	const vite = await import("vite");
	return await vite.createServer(config);
}

/**
 *
 * @param {import("vite").InlineConfig & { router: import("./types.d.ts").RouterConfig; bundler: import("./types.d.ts").BundlerConfig}} config
 */
async function createBuild(config) {
	const vite = await import("vite");
	return await vite.build(config);
}

/** @type {import("./types.d.ts").CreateRouterMode} */
const createRouterMode = (mode) => {
	return mode;
};

function createDevManifest(appConfig, viteServer) {
	const manifest = new Proxy(
		{},
		{
			get(target, bundlerName) {
				invariant(typeof bundlerName === "string", "Bundler name expected");
				// let bundler = appConfig.bundlers.find(
				// 	(bundler) => bundler.name === bundlerName,
				// );
				let router = appConfig.routers.find(
					(router) => router.name === bundlerName,
				);
				let bundler = appConfig.bundlers.find(
					(bundler) => bundler.name === router.build,
				);
				return {
					json() {
						return {};
					},
					assets() {
						return {};
					},
					inputs: new Proxy(
						{},
						{
							get(target, input, receiver) {
								invariant(typeof input === "string", "Input string expected");
								let absolutePath = isAbsolute(input)
									? input
									: join(process.cwd(), input);

								invariant(
									router.dir
										? absolutePath.startsWith(router.dir) ||
												router.handler === absolutePath
										: router.handler === absolutePath,
									`Could not find entry ${input} in any router with bundler ${bundlerName}`,
								);

								if (bundler.target === "browser") {
									return {
										async assets() {
											return [
												...Object.entries(
													await collectStyles(viteServer, [input]),
												).map(([key, value]) => ({
													tag: "style",
													type: "text/css",
													key,
													"data-vite-dev-id": key,
													dangerouslySetInnerHTML: {
														__html: value,
													},
												})),
												{
													key: "react-refresh",
													tag: "script",
													type: "module",
													async: true,
													dangerouslySetInnerHTML: {
														__html: `
																				import RefreshRuntime from "/_pages/@react-refresh"
																				RefreshRuntime.injectIntoGlobalHook(window)
																				window.$RefreshReg$ = () => {}
																				window.$RefreshSig$ = () => (type) => type
																				window.__vite_plugin_react_preamble_installed__ = true
																		`,
													},
												},
												{
													key: "vite-client",
													tag: "script",
													type: "module",
													src: join(router.prefix, "@vite", "client"),
												},
											];
										},
										output: {
											path: join(router.prefix, "@fs", process.cwd(), input),
										},
									};
								} else {
									return {
										async assets() {
											return [
												...Object.entries(
													await collectStyles(viteServer, [input]),
												).map(([key, value]) => ({
													tag: "style",
													type: "text/css",
													key,
													"data-vite-dev-id": key,
													dangerouslySetInnerHTML: {
														__html: value,
													},
												})),
												{
													key: "react-refresh",
													tag: "script",
													type: "module",
													async: true,
													dangerouslySetInnerHTML: {
														__html: `
																				import RefreshRuntime from "/_pages/@react-refresh"
																				RefreshRuntime.injectIntoGlobalHook(window)
																				window.$RefreshReg$ = () => {}
																				window.$RefreshSig$ = () => (type) => type
																				window.__vite_plugin_react_preamble_installed__ = true
																		`,
													},
												},
												{
													key: "vite-client",
													tag: "script",
													type: "module",
													src: join(router.prefix, "@vite", "client"),
												},
											];
										},
										output: {
											path: absolutePath,
										},
									};
								}
							},
						},
					),
				};
			},
		},
	);

	return manifest;
}

function createProdManifest(appConfig) {
	const manifest = new Proxy(
		{},
		{
			get(target, bundlerName) {
				invariant(typeof bundlerName === "string", "Bundler name expected");
				let router = appConfig.routers.find(
					(router) => router.name === bundlerName,
				);
				let bundler = appConfig.bundlers.find(
					(bundler) => bundler.name === router.build,
				);
				const bundlerManifest = JSON.parse(
					fs.readFileSync(
						join(bundler.outDir, router.prefix, "manifest.json"),
						"utf-8",
					),
				);

				return {
					async assets() {
						let assets = {};
						for (const route of router.fileRouter.routes) {
							assets[route.filePath] = await this.inputs[
								route.filePath
							].assets();
						}
						return assets;
					},
					async json() {
						let json = {};
						for (const input of Object.keys(this.inputs)) {
							json[input] = {
								output: this.inputs[input].output.path,
								assets: await this.inputs[input].assets(),
							};
						}
						return json;
					},
					inputs: new Proxy(
						{},
						{
							ownKeys(target) {
								const keys = Object.keys(bundlerManifest).map((id) =>
									join(process.cwd(), id),
								);
								return keys;
							},
							getOwnPropertyDescriptor(k) {
								return {
									enumerable: true,
									configurable: true,
								};
							},
							get(target, input) {
								invariant(typeof input === "string", "Input expected");
								if (bundler.target === "node") {
									return {
										output: {
											path: join(
												bundler.outDir,
												router.prefix,
												bundlerManifest[relative(process.cwd(), input)].file,
											),
										},
									};
								} else if (bundler.target === "node-web") {
									return {
										output: {
											path: join(
												bundler.outDir,
												bundlerManifest[relative(process.cwd(), input)].file,
											),
										},
									};
								} else if (bundler.target === "browser") {
									return {
										assets() {
											return findAssetsInManifest(
												bundlerManifest,
												relative(process.cwd(), input),
											)
												.filter((asset) => asset.endsWith(".css"))
												.map((asset) => ({
													tag: "link",
													href: join(router.prefix, asset),
													key: join(router.prefix, asset),
													rel: "stylesheet",
													precendence: "high",
												}));
										},
										output: {
											path: join(
												router.prefix,
												bundlerManifest[relative(process.cwd(), input)].file,
											),
										},
									};
								}
							},
						},
					),
				};
			},
		},
	);

	return manifest;
}

const routers = {
	static: createRouterMode({
		name: "static",
		async prodMiddleware(router, appConfig, app) {
			const bundler = this.getBundler(router);
			if (router.prefix) {
				app.use(
					router.prefix,
					serveStatic(join(bundler.outDir, router.prefix)),
				);
			} else {
				app.use(serveStatic(bundler.outDir));
			}
		},
		async devMiddleware(router, appConfig, app) {
			if (router.prefix) {
				app.use(router.prefix, serveStatic(router.dir));
			} else {
				app.use(serveStatic(router.dir));
			}
		},
		resolveConfig(router, appConfig) {
			let dir = router.dir
				? isAbsolute(router.dir)
					? router.dir
					: join(appConfig.root, router.dir)
				: undefined;

			invariant(dir, "No dir found for static router");

			return {
				prefix: undefined,
				...router,
				root: appConfig.root,
				dir,
			};
		},
		build(router, appConfig) {
			const bundler = this.getBundler(router);
			fs.promises.cp(router.dir, join(bundler.outDir, router.prefix), {
				recursive: true,
			});
		},
	}),
	spa: createRouterMode({
		name: "spa",
		async prodMiddleware(router, appConfig, app) {
			const bundler = this.getBundler(router);
			app.use(router.prefix, serveStatic(join(bundler.outDir, router.prefix)));
			app.use(router.prefix, (req, res) => {
				res.setHeader("Content-Type", "text/html");
				res.write(
					fs.readFileSync(join(bundler.outDir, router.prefix, "index.html")),
				);
				res.end();
			});
		},
		async devMiddleware(router, appConfig, app) {
			let bundler = this.getBundler(router);
			let viteServer = await createDevServer({
				server: {
					middlewareMode: true,
					hmr: {
						port: 8990 + router.index,
					},
				},
				router,
				bundler,
				base: router.prefix,
				appType: "spa",
				publicDir: relative(router.root, router.public),
				root: router.root,
				plugins: bundler.plugins,
				build: {
					rollupOptions: {
						input: router.handler,
					},
				},
			});

			// vite's spa appType takes care of serving the index.html file for all routes at this prefix
			app.use(router.prefix, viteServer.middlewares);
		},
		async build(router, appConfig) {
			const bundler = this.getBundler(router);
			const vite = await import("vite");
			let entries = [router.handler];
			if (router.fileRouter) {
				const { default: fg } = await import("fast-glob");
				const files = fg.sync(
					join(router.dir, "**/*") + `.{ts,tsx,js,jsx}`,
					{},
				);
				entries.push(...files);
			}
			console.log(entries);
			await createBuild({
				build: {
					rollupOptions: {
						input: entries,
						preserveEntrySignatures: "exports-only",
					},
					manifest: true,
					outDir: relative(router.root, join(bundler.outDir, router.prefix)),
					emptyOutDir: false,
				},
				root: relative(appConfig.root, router.root),
				router,
				bundler,
				publicDir: relative(router.root, router.public),
				base: router.prefix,
				plugins: bundler.plugins,
			});
		},
		resolveConfig(router, appConfig) {
			let dir = router.dir
				? isAbsolute(router.dir)
					? router.dir
					: join(appConfig.root, router.dir)
				: undefined;

			let routerStyle = router.style ?? "static";

			let fileRouter =
				routerStyle !== "static" && router.dir
					? new FileSystemRouter({ dir, style: router.style })
					: undefined;

			invariant(
				fileRouter ? router.handler : true,
				"No handler found for SPA router. When `dir` is being used with `style` for file system routing, `handler` must be specified.",
			);

			let handler = router.handler
				? isAbsolute(router.handler)
					? router.handler
					: join(appConfig.root, router.handler)
				: dir
				? join(dir, "index.html")
				: undefined;

			invariant(handler, "No handler found for SPA router");

			let root = dirname(handler);

			let publicDir = router.public
				? isAbsolute(router.public)
					? router.public
					: join(appConfig.root, router.public)
				: undefined;

			return {
				prefix: undefined,
				...router,
				root,
				dir,
				handler,
				public: publicDir,
				style: routerStyle,
				fileRouter,
			};
		},
	}),
	build: createRouterMode({
		name: "build",
		async prodMiddleware(router, appConfig, app) {
			const bundler = this.getBundler(router);
			app.use(router.prefix, serveStatic(join(bundler.outDir, router.prefix)));
			app.use(router.prefix, (req, res) => {
				res.setHeader("Content-Type", "text/html");
				res.write(
					fs.readFileSync(join(bundler.outDir, router.prefix, "index.html")),
				);
				res.end();
			});
		},
		async devMiddleware(router, appConfig, app) {
			let bundler = this.getBundler(router);
			let viteServer = await createDevServer({
				server: {
					middlewareMode: true,
					hmr: {
						port: 8990 + router.index,
					},
				},
				router,
				bundler,
				base: router.prefix,
				appType: "custom",
				publicDir: false,
				root: router.root,
				plugins: bundler.plugins,
				build: {
					rollupOptions: {
						input: router.handler,
					},
				},
			});

			// vite's custom appType takes care of serving the js assets for all routes at this prefix
			app.use(router.prefix, viteServer.middlewares);
		},
		async build(router, appConfig) {
			const bundler = this.getBundler(router);
			let entries = [router.handler];
			if (router.fileRouter) {
				for (let file of router.fileRouter.routes) {
					entries.push(file.filePath);
				}
			}
			await createBuild({
				build: {
					rollupOptions: {
						input: entries,
						preserveEntrySignatures: "exports-only",
					},
					manifest: true,
					outDir: relative(router.root, join(bundler.outDir, router.prefix)),
					emptyOutDir: false,
				},
				root: relative(appConfig.root, router.root),
				router,
				bundler,
				publicDir: false,
				base: router.prefix,
				plugins: bundler.plugins,
			});
		},
		resolveConfig(router, appConfig) {
			let dir = router.dir
				? isAbsolute(router.dir)
					? router.dir
					: join(appConfig.root, router.dir)
				: undefined;

			let routerStyle = router.style ?? "static";

			let fileRouter =
				routerStyle !== "static" && dir
					? new FileSystemRouter({ dir, style: routerStyle })
					: undefined;

			invariant(
				fileRouter ? router.handler : true,
				"No handler found for SPA router. When `dir` is being used with `style` for file system routing, `handler` must be specified.",
			);

			let handler = router.handler
				? isAbsolute(router.handler)
					? router.handler
					: join(appConfig.root, router.handler)
				: undefined;

			invariant(handler, "No handler found for SPA router");

			return {
				prefix: undefined,
				...router,
				root: appConfig.root,
				dir,
				handler,
				style: routerStyle,
				fileRouter,
			};
		},
	}),
	// handler: {
	// 	resolveConfig(router, appConfig) {
	// 		let dir = router.dir
	// 			? isAbsolute(router.dir)
	// 				? router.dir
	// 				: join(appConfig.root, router.dir)
	// 			: undefined;

	// 		let handler = router.handler
	// 			? isAbsolute(router.handler)
	// 				? router.handler
	// 				: join(appConfig.root, router.handler)
	// 			: undefined;

	// 		invariant(handler, "No handler found for router");

	// 		let routerStyle = router.style ?? "static";

	// 		let fileRouter =
	// 			routerStyle !== "static" && router.dir
	// 				? new FileSystemRouter({ dir, style: router.style })
	// 				: undefined;

	// 		return {
	// 			prefix: undefined,
	// 			...router,
	// 			root: appConfig.root,
	// 			dir,
	// 			handler,
	// 			style: routerStyle,
	// 			fileRouter,
	// 		};
	// 	},
	// },
	"node-handler": createRouterMode({
		name: "node-handler",
		async prodMiddleware(router, appConfig, app) {
			invariant(
				router.mode === "node-handler",
				"prodMiddleware called for non-node-handler router",
			);
			const bundler = this.getBundler(router);
			const bunlderManifest = JSON.parse(
				fs.readFileSync(
					join(bundler.outDir, router.prefix, "manifest.json"),
					"utf-8",
				),
			);

			let handlerAsset = bunlderManifest[relative(router.root, router.handler)];

			const manifest = createProdManifest(appConfig);

			let middleware = async (req, res) => {
				const handler = await import(
					join(bundler.outDir, router.prefix, handlerAsset.file)
				);
				let context = {
					manifest,
					prefix: router.prefix,
					import: (id) => import(id),
				};

				if (router.fileRouter) {
					context.match = router.fileRouter.match(req.url);
				}

				try {
					await handler.default(req, res, context);
				} catch (e) {
					res.statusCode = 500;
					res.end(this.renderError(e));
				}
			};

			if (router.prefix) {
				app.use(router.prefix, middleware);
			} else {
				app.use(middleware);
			}
		},
		async devMiddleware(router, appConfig, app) {
			const bundler = this.getBundler(router);
			let viteServer = await createDevServer({
				server: {
					middlewareMode: true,
					hmr: {
						port: 8990 + router.index,
					},
					base: router.prefix,
				},
				router,
				bundler,
				plugins: bundler.plugins,
				base: router.prefix,
				build: {
					rollupOptions: {
						input: router.handler,
					},
				},
			});

			const manifest = createDevManifest(appConfig, viteServer);
			let middleware = async (req, res, next) => {
				let handler = await viteServer.ssrLoadModule(router.handler);
				invariant(
					"default" in handler,
					"Handler should default export a function",
				);

				let context = {
					manifest,
					prefix: router.prefix,
					import: (id) => viteServer.ssrLoadModule(id),
				};

				if (router.fileRouter) {
					context.match = router.fileRouter.match(req.url);
				}

				try {
					await handler.default(req, res, context);
				} catch (e) {
					res.statusCode = 500;
					res.end(this.renderError(e));
				}
			};

			if (router.prefix) {
				app.use(router.prefix, middleware);
			} else {
				app.use(middleware);
			}
		},
		async build(router, appConfig) {
			const bundler = this.getBundler(router);
			const vite = await import("vite");
			let entries = [router.handler];
			if (router.fileRouter) {
				router.fileRouter.routes.forEach((route) => {
					entries.push(route.filePath);
				});
			}

			console.log({ entries });

			await createBuild({
				build: {
					rollupOptions: {
						input: entries,
					},
					ssr: true,
					manifest: true,
					ssrEmitAssets: true,
					outDir: join(bundler.outDir, router.prefix),
					emptyOutDir: false,
				},
				base: router.prefix,
				router,
				bundler,
				plugins: bundler.plugins,
				publicDir: false,
			});
		},
		resolveConfig(router, appConfig) {
			let handler = router.handler
				? isAbsolute(router.handler)
					? router.handler
					: join(appConfig.root, router.handler)
				: undefined;

			invariant(handler, "No handler found for node-handler router");

			let dir = router.dir
				? isAbsolute(router.dir)
					? router.dir
					: join(appConfig.root, router.dir)
				: undefined;

			let routerStyle = router.style ?? "static";

			invariant(
				routerStyle !== "static" ? dir : true,
				`There should be dir provided if the router style is ${routerStyle}`,
			);

			let fileRouter =
				routerStyle !== "static" && router.dir
					? new FileSystemRouter({ dir, style: router.style })
					: undefined;

			invariant(
				fileRouter ? router.handler : true,
				"No handler found for SPA router. When `dir` is being used with `style` for file system routing, `handler` must be specified.",
			);

			return {
				prefix: undefined,
				...router,
				root: appConfig.root,
				dir,
				style: routerStyle,
				fileRouter,
				handler,
			};
		},
	}),
};

class App {
	/** @type {import('./types.d.ts').AppConfig} */
	config;
	constructor(/** @type {import('./types.d.ts').AppConfig} */ config) {
		this.config = {
			// filter out the undefineds
			routers: config.routers.filter(Boolean).map((router, index) => {
				if (router.mode in routers) {
					return {
						...routers[router.mode].resolveConfig(router, {
							root: process.cwd(),
						}),
						index,
					};
				}
				return router;
				// let dir = router.dir
				// 	? isAbsolute(router.dir)
				// 		? router.dir
				// 		: join(process.cwd(), router.dir)
				// 	: undefined;
				// let publicDir = router.public
				// 	? join(process.cwd(), router.public)
				// 	: undefined;
				// let handler = router.handler
				// 	? join(process.cwd(), router.handler)
				// 	: undefined;
				// return {
				// 	prefix: "/",
				// 	...router,
				// 	dir,
				// 	id: index,
				// 	handler,
				// 	public: publicDir,
				// 	fileRouter: dir
				// 		? new FileSystemRouter({
				// 				dir,
				// 				style: router.style,
				// 		  })
				// 		: undefined,
				// };
			}),
			bundlers: config.bundlers.filter(Boolean).map((bundler, index) => {
				let outDir = bundler.outDir
					? join(process.cwd(), bundler.outDir)
					: undefined;
				return {
					target: "static",
					...bundler,
					id: index,
					outDir,
				};
			}),
			root: process.cwd(),
		};
		this.validateConfig();
		console.log(this.config);
	}

	validateConfig() {
		const bundlerRouters = {
			static: ["static"],
			browser: ["spa", "mpa", "build"],
			node: ["node-handler"],
			"node-web": ["handler"],
		};

		for (const bundler of this.config.bundlers) {
			const routers = this.config.routers.filter(
				(r) => r.build === bundler.name,
			);
			const prefixes = new Set();
			for (const router of routers) {
				invariant(
					bundlerRouters[bundler.target].includes(router.mode),
					`Invalid mode ${router.mode} for bundler ${
						bundler.name
					}. Should be one of ${bundlerRouters[bundler.target].join(", ")}`,
				);

				if (router.prefix) {
					invariant(
						!prefixes.has(router.prefix),
						`Duplicate prefix ${router.prefix} for bundler ${bundler.name}`,
					);
					prefixes.add(router.prefix);
				}
			}
		}
	}
	renderError(error) {
		console.error(error);
		return `
			<html>
				<head></head>
				<body>
					<script type="module">
						${fs.readFileSync("./lib/overlay.js")}
						let overlay = new ErrorOverlay(${JSON.stringify({
							message: error.message,
							frame: error.frame,
							loc: error.loc,
							stack: error.stack,
						})}); 
						document.body.appendChild(overlay)
					</script>
				</body>
			</html>
		`;
	}

	getBundler(router) {
		const bundlerConfig = this.config.bundlers.find(
			(bundler) => bundler.name === router.build,
		);
		invariant(bundlerConfig, `No bundler config found for ${router.build}`);
		return bundlerConfig;
	}

	async serve({ port = 3000, dev = false }) {
		const app = connect();

		for (const router of this.config.routers) {
			if (router.mode in routers) {
				if (dev) {
					await routers[router.mode].devMiddleware.apply(this, [
						router,
						this.config,
						app,
					]);
				} else {
					await routers[router.mode].prodMiddleware.apply(this, [
						router,
						this.config,
						app,
					]);
				}
			}
			// switch (router.mode) {
			// 	case "build": {
			// 		if (dev) {
			// 			let bundler = this.getBundler(router);
			// 			const vite = await import("vite");

			// 			let viteServer = await vite.createServer({
			// 				server: {
			// 					middlewareMode: true,
			// 					hmr: {
			// 						port: 8990 + router.id,
			// 					},
			// 				},
			// 				router,
			// 				bundler,
			// 				base: router.prefix,
			// 				appType: "custom",
			// 				plugins: bundler.plugins,
			// 				build: {
			// 					rollupOptions: {
			// 						input: router.handler,
			// 					},
			// 				},
			// 			});
			// 			app.use(router.prefix, viteServer.middlewares);
			// 		} else {
			// 			const bundler = this.getBundler(router.build);
			// 			app.use(
			// 				router.prefix,
			// 				serveStatic(join(bundler.outDir, router.prefix)),
			// 			);
			// 		}
			// 		break;
			// 	}
			// 	case "spa": {
			// 		if (dev) {
			// 			await routers["spa"].devMiddleware.apply(this, [router, app]);
			// 		} else {
			// 			await routers["spa"].prodMiddleware.apply(this, [router, app]);
			// 		}
			// 		break;
			// 	}
			// 	case "handler": {
			// 		let middleware;
			// 		if (dev) {
			// 			const vite = await import("vite");
			// 			let bundlerConfig = this.getBundler(router.build);

			// 			let viteServer = await vite.createServer({
			// 				server: {
			// 					middlewareMode: true,
			// 					hmr: {
			// 						port: 8989,
			// 					},
			// 				},
			// 				plugins: bundlerConfig.plugins,
			// 				base: router.prefix,
			// 				appType: "custom",
			// 				build: {
			// 					rollupOptions: {
			// 						input: router.handler,
			// 					},
			// 				},
			// 			});

			// 			let fileRouter;
			// 			if (router.style) {
			// 				invariant(
			// 					router.dir,
			// 					`The "${router.style}" router style needs a router.dir option to read the pages from`,
			// 				);
			// 				fileRouter = new FileSystemRouter({
			// 					dir: router.dir,
			// 					style: router.style,
			// 				});
			// 			}

			// 			const bundlers = this.config.bundlers;
			// 			const routers = this.config.routers;

			// 			const manifest = new Proxy(
			// 				{},
			// 				{
			// 					get(target, bundlerName) {
			// 						let bundler = bundlers.find(
			// 							(bundler) => bundler.name === bundlerName,
			// 						);
			// 						let bundlerRouters = routers.filter(
			// 							(router) => router.build === bundlerName,
			// 						);
			// 						return {
			// 							json() {
			// 								return {};
			// 							},
			// 							assets() {
			// 								return {};
			// 							},
			// 							inputs: new Proxy(
			// 								{},
			// 								{
			// 									get(target, input, receiver) {
			// 										let absolutePath = isAbsolute(input)
			// 											? input
			// 											: join(process.cwd(), input);
			// 										let router = bundlerRouters.find((r) =>
			// 											r.dir
			// 												? absolutePath.startsWith(r.dir) ||
			// 												  r.handler === absolutePath
			// 												: r.handler === absolutePath,
			// 										);

			// 										invariant(
			// 											router,
			// 											`Could not find entry ${input} in any router with bundler ${bundlerName}`,
			// 										);

			// 										if (bundler.target === "browser") {
			// 											return {
			// 												async assets() {
			// 													return [
			// 														...Object.entries(
			// 															await collectStyles(viteServer, [input]),
			// 														).map(([key, value]) => ({
			// 															tag: "style",
			// 															type: "text/css",
			// 															key,
			// 															"data-vite-dev-id": key,
			// 															dangerouslySetInnerHTML: {
			// 																__html: value,
			// 															},
			// 														})),
			// 														{
			// 															key: "react-refresh",
			// 															tag: "script",
			// 															type: "module",
			// 															async: true,
			// 															dangerouslySetInnerHTML: {
			// 																__html: `
			// 																		import RefreshRuntime from "/_pages/@react-refresh"
			// 																		RefreshRuntime.injectIntoGlobalHook(window)
			// 																		window.$RefreshReg$ = () => {}
			// 																		window.$RefreshSig$ = () => (type) => type
			// 																		window.__vite_plugin_react_preamble_installed__ = true
			// 																`,
			// 															},
			// 														},
			// 														{
			// 															key: "vite-client",
			// 															tag: "script",
			// 															type: "module",
			// 															src: join(router.prefix, "@vite", "client"),
			// 														},
			// 													];
			// 												},
			// 												output: {
			// 													path: join(
			// 														router.prefix,
			// 														"@fs",
			// 														process.cwd(),
			// 														input,
			// 													),
			// 												},
			// 											};
			// 										} else {
			// 											return {
			// 												async assets() {
			// 													return [
			// 														...Object.entries(
			// 															await collectStyles(viteServer, [input]),
			// 														).map(([key, value]) => ({
			// 															tag: "style",
			// 															type: "text/css",
			// 															key,
			// 															"data-vite-dev-id": key,
			// 															dangerouslySetInnerHTML: {
			// 																__html: value,
			// 															},
			// 														})),
			// 														{
			// 															key: "react-refresh",
			// 															tag: "script",
			// 															type: "module",
			// 															async: true,
			// 															dangerouslySetInnerHTML: {
			// 																__html: `
			// 																		import RefreshRuntime from "/_pages/@react-refresh"
			// 																		RefreshRuntime.injectIntoGlobalHook(window)
			// 																		window.$RefreshReg$ = () => {}
			// 																		window.$RefreshSig$ = () => (type) => type
			// 																		window.__vite_plugin_react_preamble_installed__ = true
			// 																`,
			// 															},
			// 														},
			// 														{
			// 															key: "vite-client",
			// 															tag: "script",
			// 															type: "module",
			// 															src: join(router.prefix, "@vite", "client"),
			// 														},
			// 													];
			// 												},
			// 												output: {
			// 													path: absolutePath,
			// 												},
			// 											};
			// 										}
			// 									},
			// 								},
			// 							),
			// 						};
			// 					},
			// 				},
			// 			);
			// 			middleware = async (req, res, next) => {
			// 				let handler = await viteServer.ssrLoadModule(router.handler);
			// 				invariant(
			// 					"default" in handler,
			// 					"Handler should default export a function",
			// 				);

			// 				let context = {
			// 					manifest,
			// 					prefix: router.prefix,
			// 					import: (id) => viteServer.ssrLoadModule(id),
			// 				};
			// 				if (fileRouter) {
			// 					context.match = fileRouter.match(req.url);
			// 				}

			// 				try {
			// 					if (bundlerConfig.target === "node") {
			// 						await handler.default(req, res, context);
			// 					} else if (bundlerConfig.target === "node-web") {
			// 						await handleNodeRequest(req, res, handler.default, context);
			// 					}
			// 				} catch (e) {
			// 					console.error(e);
			// 					viteServer.ssrFixStacktrace(e);
			// 					res.setHeader("content-type", "text/html");
			// 					res.write(this.renderError(e));
			// 					res.end();
			// 				}
			// 			};
			// 		} else {
			// 			const bundlerConfig = this.getBundler(router.build);
			// 			const bundlerManifest = JSON.parse(
			// 				fs.readFileSync(
			// 					join(bundlerConfig.outdir, "manifest.json"),
			// 					"utf-8",
			// 				),
			// 			);

			// 			let handlerAsset =
			// 				bundlerManifest[relative(process.cwd(), router.handler)];

			// 			const bundlers = this.config.bundlers;
			// 			const routers = this.config.routers;

			// 			const manifest = new Proxy(
			// 				{},
			// 				{
			// 					get(target, bundlerName) {
			// 						const bundler = bundlers.find(
			// 							(bundler) => bundler.name === bundlerName,
			// 						);
			// 						let bundlerRouters = routers.filter(
			// 							(router) => router.build === bundlerName,
			// 						);
			// 						const bundlerManifest = JSON.parse(
			// 							fs.readFileSync(
			// 								join(bundler.outdir, "manifest.json"),
			// 								"utf-8",
			// 							),
			// 						);

			// 						let router = bundlerRouters[0];

			// 						return {
			// 							async assets() {
			// 								let assets = {};
			// 								for (const route of router.fileRouter.routes) {
			// 									assets[route.filePath] = await this.inputs[
			// 										route.filePath
			// 									].assets();
			// 								}
			// 								return assets;
			// 							},
			// 							async json() {
			// 								let json = {};
			// 								for (const input of Object.keys(this.inputs)) {
			// 									json[input] = {
			// 										output: this.inputs[input].output.path,
			// 										assets: await this.inputs[input].assets(),
			// 									};
			// 								}
			// 								return json;
			// 							},
			// 							inputs: new Proxy(
			// 								{},
			// 								{
			// 									ownKeys(target) {
			// 										const keys = Object.keys(bundlerManifest).map((id) =>
			// 											join(process.cwd(), id),
			// 										);
			// 										return keys;
			// 									},
			// 									getOwnPropertyDescriptor(k) {
			// 										return {
			// 											enumerable: true,
			// 											configurable: true,
			// 										};
			// 									},
			// 									get(target, input) {
			// 										if (bundler.target === "node") {
			// 											return {
			// 												output: {
			// 													path: join(
			// 														process.cwd(),
			// 														bundler.outdir,
			// 														bundlerManifest[
			// 															relative(process.cwd(), input)
			// 														].file,
			// 													),
			// 												},
			// 											};
			// 										} else if (bundler.target === "node-web") {
			// 											return {
			// 												output: {
			// 													path: join(
			// 														process.cwd(),
			// 														bundler.outdir,
			// 														bundlerManifest[
			// 															relative(process.cwd(), input)
			// 														].file,
			// 													),
			// 												},
			// 											};
			// 										} else if (bundler.target === "browser") {
			// 											return {
			// 												assets() {
			// 													return findAssetsInManifest(
			// 														bundlerManifest,
			// 														relative(process.cwd(), input),
			// 													)
			// 														.filter((asset) => asset.endsWith(".css"))
			// 														.map((asset) => ({
			// 															tag: "link",
			// 															href: join(bundlerRouters[0].prefix, asset),
			// 															key: join(bundlerRouters[0].prefix, asset),
			// 															rel: "stylesheet",
			// 															precendence: "high",
			// 														}));
			// 												},
			// 												output: {
			// 													path: join(
			// 														// TODO handle multiple bundler routers
			// 														bundlerRouters[0].prefix,
			// 														bundlerManifest[
			// 															relative(process.cwd(), input)
			// 														].file,
			// 													),
			// 												},
			// 											};
			// 										}
			// 									},
			// 								},
			// 							),
			// 						};
			// 					},
			// 				},
			// 			);

			// 			middleware = async (req, res) => {
			// 				const handler = await import(
			// 					join(process.cwd(), bundlerConfig.outdir, handlerAsset.file)
			// 				);

			// 				const context = {
			// 					manifest,
			// 					import: (id) => import(id),
			// 					prefix: router.prefix,
			// 				};

			// 				if (router.fileRouter) {
			// 					let match = router.fileRouter.match(req.url);

			// 					if (match) {
			// 						// match.filePath =
			// 						// ;
			// 						context.match = match;
			// 					}
			// 				}
			// 				try {
			// 					if (bundlerConfig.target === "node") {
			// 						await handler.default(req, res, context);
			// 					} else if (bundlerConfig.target === "node-web") {
			// 						await handleNodeRequest(req, res, handler.default, context);
			// 					}
			// 				} catch (e) {
			// 					console.error(e);
			// 					res.setHeader("content-type", "text/html");
			// 					res.write(this.renderError(e));
			// 					res.end();
			// 				}
			// 			};
			// 		}

			// 		if (router.prefix) {
			// 			app.use(router.prefix, middleware);
			// 		} else {
			// 			app.use(middleware);
			// 		}
			// 		break;
			// 	}
			// }
		}

		app.use((req, res) => {
			res.setHeader("content-type", "text/html");
			res.write(
				this.renderError({ message: `No router found for ${req.url}` }),
			);
			res.end();
		});

		createServer(app).listen(port, () => {
			console.log(`Listening on http://localhost:${port}`);
		});
	}

	async build() {
		const appConfig = {
			root: process.cwd(),
		};
		for (const bundler of this.config.bundlers) {
			if (fs.existsSync(bundler.outDir)) {
				await fs.promises.rm(bundler.outDir, { recursive: true });
			}
		}

		for (const router of this.config.routers) {
			const bundler = this.getBundler(router);
			if (router.mode in routers) {
				await routers[router.mode].build.apply(this, [router, appConfig]);
			}
			continue;
			// switch (router.mode) {
			// case "static": {
			// 	fs.cpSync(router.dir, join(bundler.outDir, router.prefix), {
			// 		recursive: true,
			// 	});
			// 	break
			// }
			// case 'spa':

			// }

			// switch (bundler.target) {
			// 	case "browser": {
			// 		const vite = await import("vite");
			// 		let entries = [router.handler];
			// 		if (router.fileRouter) {
			// 			const { default: fg } = await import("fast-glob");
			// 			const files = fg.sync(
			// 				join(router.dir, "**/*") + `.{ts,tsx,js,jsx}`,
			// 				{},
			// 			);
			// 			entries.push(...files.map((file) => relative(router.root, file)));
			// 		}
			// 		await vite.build({
			// 			build: {
			// 				rollupOptions: {
			// 					input: entries,
			// 					preserveEntrySignatures: "exports-only",
			// 				},
			// 				root: relative(appConfig.root, router.root),
			// 				manifest: true,
			// 				outDir: relative(
			// 					router.root,
			// 					join(bundler.outDir, router.prefix),
			// 				),
			// 				emptyOutDir: false,
			// 			},
			// 			root: relative(appConfig.root, router.root),
			// 			router,
			// 			bundler,
			// 			publicDir: relative(router.root, router.public),
			// 			base: router.prefix,
			// 			plugins: bundler.plugins,
			// 		});
			// 		break;
			// 	}
			// 	case "node": {
			// 		const vite = await import("vite");
			// 		let entries = [router.handler];
			// 		if (router.fileRouter) {
			// 			const { default: fg } = await import("fast-glob");
			// 			const files = fg.sync(
			// 				join(router.dir, "**/*") + `.{ts,tsx,js,jsx}`,
			// 				{},
			// 			);
			// 			entries.push(...files.map((file) => relative(router.root, file)));
			// 		}

			// 		await vite.build({
			// 			build: {
			// 				rollupOptions: {
			// 					input: router.handler,
			// 				},
			// 				ssr: true,
			// 				manifest: true,
			// 				ssrEmitAssets: true,
			// 				outDir: join(bundler.outDir, router.prefix),
			// 				emptyOutDir: false,
			// 			},
			// 			publicDir: false,
			// 		});
			// 	}
			// }
		}
		// for (const bundler of this.config.bundlers) {
		// 	const routers = this.config.routers.filter(
		// 		(r) => r.build === bundler.name,
		// 	);

		// 	let entries = [];
		// 	let base = "/";
		// 	let root = process.cwd();
		// 	let publicDir = undefined;
		// 	let mainRouter;

		// 	for (const router of routers) {
		// 		switch (router.mode) {
		// 			case "static": {
		// 				fs.cpSync(router.dir, bundler.outdir, {
		// 					recursive: true,
		// 				});
		// 				break;
		// 			}
		// 			case "spa": {
		// 				entries = { index: join(router.dir, "index.html") };
		// 				base = router.prefix;
		// 				root = router.dir;
		// 				publicDir = relative(router.dir, router.public);
		// 				mainRouter = router;
		// 				break;
		// 			}
		// 			case "build": {
		// 				if (router.handler) {
		// 					entries.push(relative(process.cwd(), router.handler));
		// 				}
		// 				mainRouter = router;

		// 				if (router.dir) {
		// 					const { default: fg } = await import("fast-glob");
		// 					const files = fg.sync(
		// 						join(router.dir, "**/*") + `.{ts,tsx,js,jsx}`,
		// 						{},
		// 					);
		// 					entries.push(
		// 						...files.map((file) => relative(process.cwd(), file)),
		// 					);
		// 					base = router.prefix;
		// 				}
		// 				break;
		// 			}
		// 			case "node-handler": {
		// 				let bundlerConfig = this.getBundler(router.build);
		// 				const vite = await import("vite");
		// 				await vite.build({
		// 					build: {
		// 						rollupOptions: {
		// 							input: router.handler,
		// 						},
		// 						ssr: true,
		// 						manifest: true,
		// 						ssrEmitAssets: true,
		// 						outDir: bundlerConfig.outdir,
		// 						emptyOutDir: false,
		// 					},
		// 					publicDir: false,
		// 				});
		// 			}
		// 			case "handler": {
		// 				if (router.handler) {
		// 					entries.push(relative(process.cwd(), router.handler));
		// 					base = router.prefix;
		// 				}

		// 				if (router.dir) {
		// 					const { default: fg } = await import("fast-glob");
		// 					const files = fg.sync(join(router.dir, "**/*"), {});
		// 					entries.push(
		// 						...files.map((file) => relative(process.cwd(), file)),
		// 					);
		// 				}
		// 				break;
		// 				// let bundlerConfig = this.getBundlerConfig(router.build);
		// 				// const vite = await import("vite");
		// 				// await vite.build({
		// 				// 	build: {
		// 				// 		rollupOptions: {
		// 				// 			input: router.handler,
		// 				// 		},
		// 				// 		ssr: true,
		// 				// 		manifest: true,
		// 				// 		ssrEmitAssets: true,
		// 				// 		outDir: bundlerConfig.outdir,
		// 				// 		emptyOutDir: false,
		// 				// 	},
		// 				// 	publicDir: false,
		// 				// });
		// 			}
		// 		}
		// 	}

		// 	if (bundler.target === "browser") {
		// 		const vite = await import("vite");
		// 		console.log({
		// 			entries,
		// 			root,
		// 			outDir: relative(join(process.cwd(), bundler.outDir), root),
		// 		});
		// 		await vite.build({
		// 			build: {
		// 				rollupOptions: {
		// 					input: entries,
		// 					preserveEntrySignatures: "exports-only",
		// 				},
		// 				root,
		// 				manifest: true,
		// 				outDir: relative(root, bundler.outDir),
		// 				emptyOutDir: false,
		// 			},
		// 			root,
		// 			router: mainRouter,
		// 			publicDir: publicDir,
		// 			base,
		// 			plugins: bundler.plugins,
		// 		});
		// 	} else if (bundler.target === "node") {
		// 		const vite = await import("vite");
		// 		await vite.build({
		// 			build: {
		// 				rollupOptions: {
		// 					input: entries,
		// 				},
		// 				ssr: true,
		// 				manifest: true,
		// 				ssrEmitAssets: true,
		// 				outDir: bundler.outdir,
		// 				emptyOutDir: false,
		// 			},
		// 			publicDir: false,
		// 		});
		// 	} else if (bundler.target === "node-web") {
		// 		const vite = await import("vite");
		// 		await vite.build({
		// 			build: {
		// 				rollupOptions: {
		// 					input: entries,
		// 				},
		// 				ssr: true,
		// 				manifest: true,
		// 				ssrEmitAssets: true,
		// 				outDir: bundler.outdir,
		// 				emptyOutDir: false,
		// 			},
		// 			publicDir: false,
		// 		});
		// 	}

		// 	// for (const router of routers) {
		// 	// 	switch (router.mode) {
		// 	// 		case "build": {
		// 	// 			cpSync(".app", join(bundler.outdir, router.prefix), {
		// 	// 				recursive: true,
		// 	// 			});
		// 	// 		}
		// 	// 	}
		// 	// }
		// }
	}
}

/**
 *
 * @param {string} id
 * @returns
 */
function virtual(id) {
	return `\0${id}`;
}

function bundler() {
	let viteServer;
	return {
		name: "app:bundler",
		resolve(id) {
			if (id.startsWith("app:")) {
				return virtual(id);
			}
		},
		configureServer(dev) {
			viteServer = dev;
		},
		async transform(code, id, options) {
			const isSSR = options?.ssr ?? false;
			if (!isSSR) {
				let [path, query] = id.split("?");
				let searchParams = new URLSearchParams(query);

				if (searchParams.get("assets") != null) {
					let assets = [
						...Object.entries(await collectStyles(viteServer, [path])).map(
							([key, value]) => ({
								tag: "style",
								type: "text/css",
								key,
								"data-vite-dev-id": key,
								dangerouslySetInnerHTML: {
									__html: value,
								},
							}),
						),
					];
					return `export default ${JSON.stringify(assets)}`;
				}
			}
		},
		async load(id) {
			if (id.startsWith("/__bundler")) {
				const [path, query] = id.split("?");
				const params = new URLSearchParams(query);
				if (path.endsWith("assets")) {
					let assets = [
						...Object.entries(
							await collectStyles(viteServer, [params.get("id")]),
						).map(([key, value]) => ({
							tag: "style",
							type: "text/css",
							key,
							"data-vite-dev-id": key,
							dangerouslySetInnerHTML: {
								__html: value,
							},
						})),
					];
					return `export default ${JSON.stringify(assets)}`;
				}
			}
		},
	};
}

function router() {
	let config;
	return {
		name: "app:router",
		async configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		async load(id) {
			if (id === join(process.cwd(), "lib", "route-config.js")) {
				if (config.router.fileRouter) {
					return `export default ${JSON.stringify(
						config.router.fileRouter.routes,
					)}`;
				}
				return `export default []`;
			}
		},
	};
}

function css() {
	let viteServer;
	return {
		name: "app:css",
		configureServer(dev) {
			viteServer = dev;
		},
		async handleHotUpdate({ file, read }) {
			if (file.endsWith(".css")) {
				viteServer.ws.send({
					type: "custom",
					event: "css-update",
					data: {
						file,
						contents: await read(),
					},
				});
				return [];
			}
		},
	};
}

function client() {
	return [bundler(), router(), css(), manifest()];
}

/**
 * @returns {import("vite").Plugin}
 */
function manifest() {
	let config;
	let env;
	return {
		name: "build-manifest",
		enforce: "post",
		config(c, e) {
			env = e;
		},
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		transformIndexHtml() {
			if (env.command === "build") {
				return [
					{
						tag: "script",
						attrs: { src: join(config.router.prefix, "manifest.js") },
						injectTo: "head",
					},
				];
			}
			return [];
		},

		async generateBundle(options, bundle) {
			const manifest = buildManifest(config, bundle, options.format);
			const routeManifest = {};
			if (config.router && config.router.fileRouter) {
				for (const route of config.router.fileRouter.routes) {
					routeManifest[route.filePath] = {
						output: join(
							config.base,
							manifest[relative(config.router.root, route.filePath)].file,
						),
						assets: findAssetsInManifest(
							manifest,
							relative(config.router.root, route.filePath),
						)
							.filter((asset) => asset.endsWith(".css"))
							.map((asset) => ({
								tag: "link",
								href: join(config.base, asset),
								key: join(config.base, asset),
								rel: "stylesheet",
								precendence: "high",
							})),
					};
				}
			}

			this.emitFile({
				fileName: "manifest.js",
				type: "asset",
				source: `window.manifest = ${JSON.stringify(routeManifest, null, 2)}`,
			});
		},
	};
}

const app = new App({
	bundlers: [
		{
			name: "static-server",
			outDir: "./.build/client",
		},
		{
			name: "simple-http",
			target: "node",
			outDir: "./.build/server",
		},
		{
			name: "simple-http-web",
			target: "node-web",
			outDir: "./.build/web-server",
		},
		{
			name: "react-ssr",
			target: "node",
			outDir: "./.build/react",
			plugins: [react()],
		},
		{
			name: "react-ssr-web",
			target: "node-web",
			outDir: "./.build/react-web",
			plugins: [react()],
		},
		{
			name: "react-client",
			target: "browser",
			outDir: "./.build/client",
			plugins: [react(), client()],
		},
		{
			name: "react-spa",
			target: "browser",
			outDir: "./.build/spa",
			plugins: [react(), client()],
		},
		{
			name: "solid-spa",
			target: "browser",
			outDir: "./.build/solid-spa",
			plugins: [solid(), client()],
		},
	],
	routers: [
		{
			mode: "static",
			dir: "./lib",
			name: "static-lib",
			build: "static-server",
			prefix: "/",
		},
		{
			name: "react-client",
			mode: "build",
			build: "react-client",
			dir: "./pages",
			style: "nextjs",
			handler: "./ssr-client.tsx",
			prefix: "/_pages",
		},
		{
			mode: "spa",
			build: "solid-spa",
			name: "solid-spa",
			dir: "./solid",
			prefix: "/solid",
			public: "./public",
		},
		{
			mode: "spa",
			build: "solid-spa",
			name: "solid-router-spa",
			dir: "./solid-router/pages",
			style: "nextjs",
			handler: "./solid-router/index.html",
			prefix: "/router",
			public: "./public",
		},
		{
			mode: "spa",
			name: "react-spa",
			build: "react-spa",
			dir: "./pages",
			style: "nextjs",
			handler: "./index.html",
			prefix: "/react",
			public: "./public",
		},
		{
			name: "api",
			mode: "node-handler",
			handler: "./api-handler.tsx",
			prefix: "/api",
			build: "simple-http",
		},
		// {
		// 	mode: "handler",
		// 	handler: "./web-api-handler.tsx",
		// 	prefix: "/web-api",
		// 	build: "simple-http-web",
		// },
		// {
		// 	mode: "handler",
		// 	handler: "./ssr-web-handler.tsx",
		// 	build: "react-ssr-web",
		// 	prefix: "/web-ssr",
		// 	style: "nextjs",
		// 	dir: "./pages",
		// },
		{
			name: "react-ssr",
			mode: "node-handler",
			handler: "./ssr-handler.tsx",
			build: "react-ssr",
			prefix: "/ssr",
			style: "nextjs",
			dir: "./pages",
		},
	],
});

if (process.argv.includes("--build")) {
	await app.build();
}

if (process.argv.includes("--serve") || process.argv.includes("--dev")) {
	await app.serve({
		port: 3000,
		dev: process.argv.includes("--dev"),
	});
}
