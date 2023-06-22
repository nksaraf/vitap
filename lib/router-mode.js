/** @type {import("./types.js").CreateRouterMode} */
export const createRouterMode = (mode) => {
  return mode;
};

export function shouldCreateWorker(bundler) {
  return bundler?.resolve?.conditions;
}
