import fs from "fs";
import { isAbsolute, join, relative } from "pathe";
import { FileSystemRouter } from "../file-system-router.js";
import invariant from "../invariant.js";
import { AppWorkerClient } from "../app-worker-client.js";
import { createRouterMode, shouldCreateWorker } from "../router-mode.js";
import { createProdManifest } from "../prod-manifest.js";
import { createDevManifest } from "../dev-manifest.js";
import { createBuild } from "../vite-utils.js";
import { isMainThread } from "node:worker_threads";
import { client } from "../app-client-plugin.js";
import { builtinModules } from "module";

export const nodeHandler = createRouterMode({
  name: "node-handler",
  async prodMiddleware(router, serveConfig, server) {
    const app = this;

    const bundler = this.getBundler(router);
    const bunlderManifest = JSON.parse(
      fs.readFileSync(
        join(bundler.outDir, router.prefix, "manifest.json"),
        "utf-8"
      )
    );

    let handlerAsset = bunlderManifest[relative(router.root, router.handler)];

    const manifest = createProdManifest(app);

    let middleware = async (req, res) => {
      const handler = await import(
        join(bundler.outDir, router.prefix, handlerAsset.file)
      );
      let context = {
        manifest,
        prefix: router.prefix,
        import: (id) => import(id),
        router,
        async fetchNode(request, response) {
          let route = app.getRouter("react-rsc");
          await server.handle(request, response, () => {
            throw new Error("No handler found");
          });
        },
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
      server.use(router.prefix, middleware);
    } else {
      server.use(middleware);
    }
  },
  async devMiddleware(router, serveConfig, server) {
    const app = this;

    if (shouldCreateWorker(router.bundler) && isMainThread) {
      router.worker = new AppWorkerClient(
        new URL("./../app-worker.js", import.meta.url)
      );
      await router.worker.init();
      server.use(
        router.prefix,
        this.createNodeMiddleware(async (req, res, next) => {
          await router.worker.fetchNode(req, res, {});
        }, router)
      );
      return;
    }

    const devServer = await this.createDevServer(
      router,
      [
        {
          name: "node-handler-dev",
          config() {
            return {
              appType: "custom",
            };
          },
        },
      ],
      serveConfig
    );

    const manifest = createDevManifest(this, devServer);

    let middleware = this.createNodeMiddleware(async (req, res, next) => {
      let handler = await devServer.ssrLoadModule(router.handler);
      invariant(
        "default" in handler,
        "Handler should default export a function"
      );

      let context = {
        manifest,
        prefix: router.prefix,
        router,
        async fetchNode(request, response) {
          let route = app.getRouter("react-rsc");
          if (route.worker) {
            await route.worker.fetchNode(request, response);
          }
        },
        import: (id) => devServer.ssrLoadModule(id),
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
    }, router);

    if (router.prefix) {
      server.use(router.prefix, middleware);
    } else {
      server.use(middleware);
    }
  },
  async build(router) {
    const bundler = this.getBundler(router);

    await createBuild({
      router,
      app: this,
      bundler,
      plugins: [build(), ...(bundler.plugins?.() ?? []), client()],
    });

    console.log("build done");
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
      `There should be dir provided if the router style is ${routerStyle}`
    );

    let fileRouter =
      routerStyle !== "static" && router.dir
        ? new FileSystemRouter({ dir, style: router.style })
        : undefined;

    invariant(
      fileRouter ? router.handler : true,
      "No handler found for SPA router. When `dir` is being used with `style` for file system routing, `handler` must be specified."
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
});

export function getEntries(router) {
  return [
    router.handler,
    ...(router.fileRouter?.routes.map((r) => r.filePath) ?? []),
  ];
}

/**
 * @returns {import('vite').Plugin}
 */
function build() {
  return {
    name: "react-rsc:node-handler",
    config(inlineConfig, env) {
      if (env.command === "build") {
        return {
          build: {
            rollupOptions: {
              input: getEntries(inlineConfig.router),
              external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
              ],
              treeshake: true,
            },
            ssr: true,
            manifest: true,
            target: "node18",
            ssrEmitAssets: true,
            outDir: join(
              inlineConfig.bundler.outDir,
              inlineConfig.router.prefix
            ),
            emptyOutDir: false,
          },
          define: {
            "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
          },
          base: inlineConfig.router.prefix,
          publicDir: false,
        };
      }
    },
  };
}
