/**
 *
 * @param {import("vite").InlineConfig & { router: import("./types.js").RouterConfig; }} config
 */
export async function createDevServer(config) {
  const vite = await import("vite");
  return await vite.createServer(config);
}
/**
 *
 * @param {import("vite").InlineConfig & { router: import("./types.js").RouterConfig; bundler: import("./types.js").BundlerConfig}} config
 */

export async function createBuild(config) {
  const vite = await import("vite");
  return await vite.build(config);
}
