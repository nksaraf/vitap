import { join, relative } from "pathe";
import findAssetsInManifest from "./assets-manifest.js";
import findStylesInModuleGraph from "./collect-styles.js";
import { createManifest } from "./spa-manifest.js";

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
            ...Object.entries(
              await findStylesInModuleGraph(viteServer, [path])
            ).map(([key, value]) => ({
              tag: "style",
              attrs: {
                type: "text/css",
                key,
                "data-vite-dev-id": key,
              },
              children: value,
            })),
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
              await findStylesInModuleGraph(viteServer, [params.get("id")])
            ).map(([key, value]) => ({
              tag: "style",
              attrs: {
                type: "text/css",
                key,
                "data-vite-dev-id": key,
              },
              children: value,
            })),
          ];
          return `export default ${JSON.stringify(assets)}`;
        }
      }
    },
  };
}
export function router() {
  let config;
  return {
    name: "app:router",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async load(id) {
      if (id === join(process.cwd(), "lib", "route-config.js")) {
        if (config.router.fileRouter) {
          return `export default ${JSON.stringify(
            config.router.fileRouter.routes
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
      const manifest = createManifest(config, bundle, options.format);
      const routeManifest = {};
      if (config.router && config.router.fileRouter) {
        for (const route of config.router.fileRouter.routes) {
          routeManifest[route.filePath] = {
            output: join(
              config.base,
              manifest[relative(config.router.root, route.filePath)].file
            ),
            assets: findAssetsInManifest(
              manifest,
              relative(config.router.root, route.filePath)
            )
              .filter((asset) => asset.endsWith(".css"))
              .map((asset) => ({
                tag: "link",
                attrs: {
                  href: join(config.base, asset),
                  key: join(config.base, asset),
                  rel: "stylesheet",
                  precendence: "high",
                },
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

export function client() {
  return [bundler(), router(), css(), manifest()];
}
