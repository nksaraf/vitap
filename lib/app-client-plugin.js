import { join, relative } from "pathe";
import findAssetsInViteManifest from "./manifest/vite-manifest.js";
import findStylesInModuleGraph from "./manifest/collect-styles.js";
import { createSPAManifest as createSPAManifest } from "./manifest/spa-manifest.js";

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
      const routeManifest = createSPAManifest(config, bundle, options.format);

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
