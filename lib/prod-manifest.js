import fs from "fs";
import { join, relative } from "pathe";
import findAssetsInManifest from "./assets-manifest.js";
import invariant from "./invariant.js";

export function createProdManifest(app) {
  const manifest = new Proxy(
    {},
    {
      get(target, routerName) {
        invariant(typeof routerName === "string", "Bundler name expected");
        const router = app.getRouter(routerName);
        const bundler = app.getBundler(router);
        const bundlerManifest = JSON.parse(
          fs.readFileSync(
            join(bundler.outDir, router.prefix, "manifest.json"),
            "utf-8"
          )
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
                const keys = Object.keys(bundlerManifest)
                  .filter(
                    (id) =>
                      id.match(/\.(ts|tsx|js|jsx)$/) &&
                      bundlerManifest[id].isEntry
                  )
                  .map((id) => join(process.cwd(), id));
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
                if (
                  bundler.target === "node" ||
                  bundler.target === "node-web"
                ) {
                  return {
                    output: {
                      path: join(
                        bundler.outDir,
                        router.prefix,
                        bundlerManifest[relative(process.cwd(), input)].file
                      ),
                    },
                  };
                } else if (bundler.target === "browser") {
                  return {
                    assets() {
                      return findAssetsInManifest(
                        bundlerManifest,
                        relative(process.cwd(), input)
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
                        bundlerManifest[relative(process.cwd(), input)].file
                      ),
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
