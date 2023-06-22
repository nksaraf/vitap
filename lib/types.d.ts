import { NextHandleFunction } from "connect";
import { InlineConfig, ViteDevServer } from "vite";

import { FileSystemRouter } from "./file-system-router";

export type HandlerContext = {
  manifest: {
    [key: string]: {
      json(): unknown;
      inputs: {
        [key: string]: {
          assets(): Promise<{ [key: string]: any }>;
          output: {
            path: string;
          };
        };
      };
    };
  };
  match: MatchedRoute;
  import: <T extends string>(id: T) => any;
};

export interface MatchedRoute {
  /**
   * A map of the parameters from the route
   *
   * @example
   * ```ts
   * const router = new FileSystemRouter({
   *   dir: "/path/to/files",
   *   style: "nextjs",
   * });
   * const {params} = router.match("/blog/2020/01/01/hello-world");
   * console.log(params.year); // "2020"
   * console.log(params.month); // "01"
   * console.log(params.day); // "01"
   * console.log(params.slug); // "hello-world"
   * ```
   */
  readonly params: Record<string, string>;
  readonly filePath: string;
  readonly pathname: string;
  readonly query: Record<string, string>;
  readonly name: string;
  readonly kind: "exact" | "catch-all" | "optional-catch-all" | "dynamic";
  readonly src: string;
}

export type BundlerConfig = {
  name: string;

  /**
   * The target environment for the bundle
   * @default null
   *
   * Each target has supported router modes:
   * - `browser`: `build`, `spa`, `mpa`
   * - `node`: `node-handler`
   * - `node-web`: `handler`
   * - null: `static`
   */
  target?: "browser" | "node" | "node-web" | "static";

  /**
   * Output directory for the bundle
   * If a router has a prefix, it will be appended to this directory, for that router's bundle
   */
  outDir?: string;

  /**
   * Vite plugins to use during dev and bundling. These are in addition to the plugins
   * added by the bundler itself
   */
  plugins?: () => import("vite").PluginOption[];

  resolve?: InlineConfig["resolve"];
};

export type RouterConfig<T extends BundlerConfig = BundlerConfig> =
  | {
      name: string;
      mode: "static";

      /** The directory containing the static files to serve */
      dir: string;

      /** The base path to use when routing */
      prefix?: string;

      build: T["name"];
      index?: number;
    }
  | {
      name: string;
      mode: "handler";

      handler: string;

      /** The directory containing the static files to serve */
      dir?: string;
      /** File routing style to use for the files in `dir` */
      style?: string;
      /** Limit the file routing to the given extensions */
      extensions?: string[];

      /** The base path to use when routing */
      prefix?: string;
      build: T["name"];
      root?: string;
      fileRouter?: FileSystemRouter;
      index?: number;
      devServer?: ViteDevServer;
    }
  | {
      name: string;
      mode: "spa";

      handler?: string;

      /** The directory containing the static files to serve */
      dir?: string;
      /** File routing style to use for the files in `dir` */
      style?: string;
      /** Limit the file routing to the given extensions */
      extensions?: string[];

      public?: string;

      /** The base path to use when routing */
      prefix?: string;
      build: T["name"];
      root?: string;
      fileRouter?: FileSystemRouter;
      index?: number;
      devServer?: ViteDevServer;
    }
  | {
      name: string;
      mode: "node-handler";

      handler: string;

      /** The directory containing the static files to serve */
      dir?: string;
      /** File routing style to use for the files in `dir` */
      style?: string;
      /** Limit the file routing to the given extensions */
      extensions?: string[];

      /** The base path to use when routing */
      prefix?: string;
      build: T["name"];
      root?: string;
      fileRouter?: FileSystemRouter;
      index?: number;
      devServer?: ViteDevServer;
    }
  | {
      /** The "build" mode is used to  */
      name: string;
      mode: "build";

      handler: string;

      /** The directory containing the static files to serve */
      dir?: string;
      /** File routing style to use for the files in `dir` */
      style?: string;
      /** Limit the file routing to the given extensions */
      extensions?: string[];

      /** The base path to use when routing */
      prefix?: string;
      build: T["name"];
      root?: string;
      fileRouter?: FileSystemRouter;
      index?: number;
      devServer?: ViteDevServer;
    };

export type AppConfig<
  T extends BundlerConfig = BundlerConfig,
  R extends RouterConfig<T> = RouterConfig<T>
> = {
  bundlers: T[];
  routers: R[];
  root?: string;
};

type ServeConfig = { port?: number; dev?: boolean; ws?: { port?: number } };

interface App<
  T extends BundlerConfig = BundlerConfig,
  R extends RouterConfig<T> = RouterConfig<T>
> {
  serve(arg0?: ServeConfig): unknown;
  build(): unknown;
  createNodeMiddleware(
    arg0: (req: any, res: any, next: any) => Promise<void>,
    router: RouterConfig
  ): NextHandleFunction;
  createDevServer(
    config: InlineConfig,
    router: RouterConfig,
    serveConfig: ServeConfig
  ): Promise<ViteDevServer>;
  createRequestId(): unknown;
  readonly config: AppConfig<T>;
  getBundler(router: RouterConfig): BundlerConfig;
  getRouter(name: string): RouterConfig;
  renderError(error: any): string;
  getEntries(router: RouterConfig): string[];
}

export type CreateRouterMode = <T extends RouterConfig["mode"]>(
  mode: RouterMode<T>
) => RouterMode<T>;

export type RouterMode<T extends RouterConfig["mode"]> = {
  name: T;
  resolveConfig: (
    config: RouterConfig & { mode: T },
    appConfig: AppConfig
  ) => RouterConfig;
  devMiddleware: (
    this: App,
    router: RouterConfig & { mode: T },
    serveConfig: ServeConfig,
    server: import("connect").Server
  ) => void;
  prodMiddleware: (
    this: App,
    router: RouterConfig & { mode: T },
    serveConfig: ServeConfig,
    server: import("connect").Server
  ) => void;
  build: (
    this: App,
    config: RouterConfig & { mode: T },
    appConfig: AppConfig
  ) => void;
};

type CreateApp = <
  T extends BundlerConfig,
  R extends RouterConfig<T> = RouterConfig<T>
>(config: {
  bundlers: T[];
  routers: R[];
}) => App<T, R>;
