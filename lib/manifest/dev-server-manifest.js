import { isAbsolute, join } from "pathe";
import findStylesInModuleGraph from "./collect-styles.js";
import invariant from "../invariant.js";

/**
 *
 * @param {import('../types.js').App} app
 * @param {import('vite').ViteDevServer} viteServer
 * @returns
 */
export function createDevManifest(app, viteServer) {
  const manifest = new Proxy(
    {},
    {
      get(target, bundlerName) {
        invariant(typeof bundlerName === "string", "Bundler name expected");

        let router = app.getRouter(bundlerName);
        invariant(
          router.mode === "build" ||
            router.mode === "handler" ||
            router.mode === "spa" ||
            router.mode === "node-handler",
          `Router mode ${router.mode} doesn't have a manifest`
        );

        let bundler = app.getBundler(router);
        return {
          json() {
            return {};
          },
          assets() {
            return {};
          },
          handler: router.handler,
          inputs: new Proxy(
            {},
            {
              get(target, input, receiver) {
                invariant(typeof input === "string", "Input string expected");
                let absolutePath = isAbsolute(input)
                  ? input
                  : join(process.cwd(), input);

                let isHandler = router.handler === absolutePath;
                let isDirEntry =
                  router.dir && absolutePath.startsWith(router.dir);

                invariant(
                  isHandler || isDirEntry,
                  `Could not find entry ${input} in any router with bundler ${bundlerName}`
                );

                async function getVitePluginAssets() {
                  const plugins = router.devServer.config.plugins.filter(
                    (plugin) => "transformIndexHtml" in plugin
                  );
                  let pluginAssets = [];
                  for (let plugin of plugins) {
                    let transformedHtml = await plugin.transformIndexHtml(
                      "/",
                      ``,
                      `/`
                    );

                    if (!transformedHtml) continue;
                    if (Array.isArray(transformedHtml)) {
                      pluginAssets.push(...transformedHtml);
                    } else if (transformedHtml.tags) {
                      pluginAssets.push(...(transformedHtml.tags ?? []));
                    }
                  }

                  return pluginAssets;
                }

                if (bundler.target === "browser") {
                  return {
                    async assets() {
                      return [
                        ...(await getVitePluginAssets()),
                        ...Object.entries(
                          await findStylesInModuleGraph(viteServer, [
                            absolutePath,
                          ])
                        ).map(([key, value]) => ({
                          tag: "style",
                          attrs: {
                            type: "text/css",
                            key,
                            "data-vite-dev-id": key,
                          },
                          children: value,
                        })),
                        isHandler
                          ? {
                              tag: "script",
                              attrs: {
                                key: "vite-client",
                                type: "module",
                                src: join(router.prefix, "@vite", "client"),
                              },
                            }
                          : undefined,
                      ].filter(Boolean);
                    },
                    output: {
                      path: join(router.prefix, "@fs", absolutePath),
                    },
                  };
                } else {
                  return {
                    async assets() {
                      return [
                        ...(await getVitePluginAssets()),
                        ...Object.entries(
                          await findStylesInModuleGraph(viteServer, [input])
                        ).map(([key, value]) => ({
                          tag: "style",
                          attrs: {
                            type: "text/css",
                            key,
                            "data-vite-dev-id": key,
                          },
                          children: value,
                        })),
                        isHandler
                          ? {
                              tag: "script",
                              attrs: {
                                key: "vite-client",
                                type: "module",
                                src: join(router.prefix, "@vite", "client"),
                              },
                            }
                          : undefined,
                      ];
                    },
                    output: {
                      path: absolutePath,
                    },
                  };
                }
              },
            }
          ),
        };
      },
    }
  );

  return manifest;
}
