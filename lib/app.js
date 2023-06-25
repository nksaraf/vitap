import connect from "connect";
import fs from "fs";
import { createServer } from "http";
import { join } from "pathe";
import colors from "picocolors";

import invariant from "./invariant.js";
import { withLogger } from "./logger.js";
import { handler } from "./router/handler.js";
import { stat } from "./router/static.js";
import { nodeHandler } from "./router/node-handler.js";
import { build } from "./router/build.js";
import { spa } from "./router/spa.js";
import { createDevServer } from "./vite-utils.js";
import { client } from "./app-client-plugin.js";

const routers = {
  static: stat,
  spa: spa,
  build: build,
  "node-handler": nodeHandler,
  handler: handler,
};

const routerModeSymbol = {
  handler: `⨍ `,
  static: `📁`,
  spa: `📃`,
  build: `🗃 `,
  "node-handler": `🟢`,
};

globalThis.onunhandledrejection = (e) => {
  console.error({ error: e });
};

export class App {
  /** @type {import('./types.d.ts').AppConfig} */
  config;
  constructor(/** @type {import('./types.d.ts').AppConfig} */ config) {
    const root = process.cwd();
    const bundlers = config.bundlers.filter(Boolean).map((bundler, index) => {
      return {
        ...this.resolveBundlerConfig(bundler),
        index,
      };
    });
    this.config = {
      // filter out the undefineds
      routers: config.routers
        .filter(Boolean)
        .map((/** @type {any} */ router, index) => {
          invariant("mode" in router, `Router ${index} is missing a mode`);
          invariant(router.mode in routers, `Invalid mode ${router.mode}`);
          return {
            ...routers[router.mode].resolveConfig(router, {
              root: process.cwd(),
            }),
            bundler: bundlers.find((b) => b.name === router.build),
            index,
          };
        }),
      bundlers: bundlers,
      root,
    };
    this.validateConfig();
  }

  resolveBundlerConfig(bundler) {
    let outDir = bundler.outDir
      ? join(process.cwd(), bundler.outDir)
      : undefined;
    return {
      target: "static",
      root: process.cwd(),
      ...bundler,
      outDir,
    };
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
        (r) => r.build === bundler.name
      );
      const prefixes = new Set();
      for (const router of routers) {
        invariant(
          bundlerRouters[bundler.target].includes(router.mode),
          `Invalid mode ${router.mode} for bundler ${
            bundler.name
          }. Should be one of ${bundlerRouters[bundler.target].join(", ")}`
        );

        if (router.prefix) {
          invariant(
            !prefixes.has(router.prefix),
            `Duplicate prefix ${router.prefix} for bundler ${bundler.name}`
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
      (bundler) => bundler.name === router.build
    );
    invariant(bundlerConfig, `No bundler config found for ${router.build}`);
    return bundlerConfig;
  }

  _requestCounter = 0;
  createRequestId() {
    return this._requestCounter++;
  }

  createNodeMiddleware(middleware, router) {
    return async (req, res, next) => {
      const requestId = this.createRequestId();
      await withLogger({ requestId, router }, async () => {
        await middleware(req, res, next);
      });
    };
  }

  async createDevServer(router, plugins, serveConfig) {
    const devServer = await createDevServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: serveConfig.ws.port + router.index,
        },
      },
      router,
      plugins: [
        plugins,
        ...((await router.bundler.plugins?.()) ?? []),
        client(),
      ],
      base: router.prefix,
      build: {
        rollupOptions: {
          input: router.handler,
        },
      },
    });

    router.devServer = devServer;
    return devServer;
  }

  async serve({ port = 3000, dev = false, ws = { port: port + 10000 } }) {
    const server = connect();

    const serveConfig = {
      ws,
      port,
      dev,
    };

    for (const router of this.config.routers) {
      if (router.mode in routers) {
        if (dev) {
          await routers[router.mode].devMiddleware.apply(this, [
            router,
            serveConfig,
            server,
          ]);
        } else {
          await routers[router.mode].prodMiddleware.apply(this, [
            router,
            serveConfig,
            server,
          ]);
        }
      }
    }

    server.use((req, res) => {
      res.setHeader("content-type", "text/html");
      res.write(this.renderError(new Error(`No router found for ${req.url}`)));
      res.end();
    });

    createServer(server).listen(port, () => {
      for (const router of this.config.routers) {
        console.log(
          routerModeSymbol[router.mode],
          colors.red(router.prefix ?? "/"),
          router.name
        );
      }
    });

    return server;
  }

  getRouter(name) {
    return this.config.routers.find((r) => r.name === name);
  }

  getEntries(router) {
    return [
      router.handler,
      ...(router.fileRouter?.routes.map((r) => r.filePath) ?? []),
    ];
  }

  async build() {
    for (const bundler of this.config.bundlers) {
      if (fs.existsSync(bundler.outDir)) {
        await fs.promises.rm(bundler.outDir, { recursive: true });
      }
    }

    for (const router of this.config.routers) {
      if (router.mode in routers) {
        await withLogger({ requestId: router.index, router }, async () => {
          await routers[router.mode].build.apply(this, [router]);
        });
      }
    }
  }
}

/** @type {import('./types.d.ts').CreateApp} */
export const createApp = (config) => {
  // @ts-expect-error
  return new App(config);
};
