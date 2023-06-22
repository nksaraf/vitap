import fs from "fs";
import { isAbsolute, join, relative } from "pathe";
import { FileSystemRouter } from "../file-system-router.js";
import invariant from "../invariant.js";
import { AppWorkerClient } from "../app-worker-client.js";
import { createRouterMode, shouldCreateWorker } from "../router-mode.js";
import { createProdManifest } from "../prod-manifest.js";
import { createDevManifest } from "../dev-manifest.js";
import { createBuild } from "../vite.js";

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
    const bundler = this.getBundler(router);

    if (shouldCreateWorker(bundler)) {
      router.worker = await new AppWorkerClient(
        new URL("./app-worker.js", import.meta.url)
      );
      await router.worker.init();
    }

    const devServer = await this.createDevServer(
      {
        appType: "custom",
      },
      router,
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
        async fetchNode(request) {
          let route = app.getRouter("react-rsc");
          if (route.worker) {
            const stream = await route.worker.fetchNode(request, context);
            return stream;
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
    const entries = this.getEntries(router);

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
