import fs from "fs";
import { isAbsolute, join, relative } from "pathe";
import serveStatic from "serve-static";
import { FileSystemRouter } from "../file-system-router.js";
import invariant from "../invariant.js";
import { createRouterMode } from "../router-mode.js";
import { createBuild } from "../vite.js";

export const build = createRouterMode({
  name: "build",
  async prodMiddleware(router, appConfig, app) {
    const bundler = this.getBundler(router);
    app.use(router.prefix, serveStatic(join(bundler.outDir, router.prefix)));
    app.use(router.prefix, (req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.write(
        fs.readFileSync(join(bundler.outDir, router.prefix, "index.html"))
      );
      res.end();
    });
  },
  async devMiddleware(router, serveConfig, app) {
    let viteServer = await this.createDevServer(
      {
        base: router.prefix,
        appType: "custom",
        publicDir: false,
        root: router.root,
      },
      router,
      serveConfig
    );

    console.log(router.prefix, viteServer.middlewares.length);

    // vite's custom appType takes care of serving the js assets for all routes at this prefix
    app.use(router.prefix, viteServer.middlewares);
  },
  async build(router) {
    const bundler = this.getBundler(router);
    const entries = this.getEntries(router);

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
      root: relative(this.config.root, router.root),
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
      "No handler found for SPA router. When `dir` is being used with `style` for file system routing, `handler` must be specified."
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
});
