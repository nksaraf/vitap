# `vitap` (The Vite App)
Compose full stack applications (and frameworks) using Vite, the versatile bundler. The two primitives in `vitap` are **bundlers** and **routers**. 

Inspired by the [Bun.App](https://bun.sh/blog/bun-bundler#sneak-peek-bun-app) API. 

- **Bundlers** are vite config "templates" that can be used by routers to specify how they should be built. Eg. "static-server", "solid-spa", "react-ssr". They are named and referenced by the routers. These are likely to be authored by frameworks for their specific needs. They are essentially vite configs without specifying the entry points.
- **Routers** are handlers that tell us how specific URLs should be handled. We support various router modes: "static", "spa", "handler", "node-handler" (and new ones can be added). Routers specify the handler file (entrypoint) to use for their `prefix`ed routes. They can also specify a `dir` and `style` in some router modes to include a file system router that is provided to the handler. Routers have to specify a bundler to use, via the `build` property. The routers tell the bundler what entry points to build. Multiple routers can use the same bundler (but they should be served at different prefixes).

## Goals

Primary goal is build the tools needed to build a NextJS or SolidStart style metaframework on top of vite without worrying about a lot of the wiring required to keep dev and prod working along with SSR, SPA, RSC, and all the other acronyms. etc. 

Mostly trying to disappear for the user outside the app.config.js file

The surface layer we are intending to tackle:
1. Full stack builds (handle manifest stuff to figure out what assets to load at prod runtime)
2. Dev time asset handling (avoiding FOUC in SSR frameworks) and smoothing over some of vite's dev/prod mismatching behaviours by providing common manifest APIs that work in dev and prod the same way
3. File system router (not any specific file system conventions, just an API for interfacing with FileSystemRouters and utils to implement your conventions in them)
4. Building the server, and providing a simple opaque `handler` API to control the server
5. Adapter stuff to deploy to various platforms with support for all the features they provide
6. Not to abstract away the platforms. Let people use what they want to the fullest
7. Have little opinion about how the app should be authored or structured

## How to run

```bash
npm install
node app.js --dev
```

```ts
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";

import { App, client } from "./lib/app.js";

const app = new App({
	bundlers: [
		{
			name: "static-server",
			outDir: "./.build/client",
		},
		{
			name: "simple-http",
			target: "node",
			outDir: "./.build/server",
		},
		{
			name: "simple-http-web",
			target: "node-web",
			outDir: "./.build/web-server",
		},
		{
			name: "react-ssr",
			target: "node",
			outDir: "./.build/react",
			plugins: [react()],
		},
		{
			name: "solid-ssr-node",
			target: "node",
			outDir: "./.build/solid",
			plugins: [solid({ ssr: true })],
		},
		{
			name: "react-ssr-web",
			target: "node-web",
			outDir: "./.build/react-web",
			plugins: [react()],
		},
		{
			name: "react-client",
			target: "browser",
			outDir: "./.build/client",
			plugins: [react(), client()],
		},
		{
			name: "solid-client",
			target: "browser",
			outDir: "./.build/solid-client",
			plugins: [solid({ ssr: true }), client()],
		},
		{
			name: "react-spa",
			target: "browser",
			outDir: "./.build/spa",
			plugins: [react(), client()],
		},
		{
			name: "solid-spa",
			target: "browser",
			outDir: "./.build/solid-spa",
			plugins: [solid(), client()],
		},
	],
	routers: [
		{
			mode: "static",
			dir: "./lib",
			name: "static-lib",
			build: "static-server",
			prefix: "/",
		},
		{
			name: "react-client",
			mode: "build",
			build: "react-client",
			dir: "./pages",
			style: "nextjs",
			handler: "./ssr-client.tsx",
			prefix: "/_pages",
		},
		{
			mode: "spa",
			build: "solid-spa",
			name: "solid-spa",
			dir: "./solid",
			prefix: "/solid",
			public: "./public",
		},
		{
			mode: "spa",
			build: "solid-spa",
			name: "solid-router-spa",
			dir: "./solid-router/pages",
			style: "nextjs",
			handler: "./solid-router/index.html",
			prefix: "/router",
			public: "./public",
		},
		{
			mode: "spa",
			name: "react-spa",
			build: "react-spa",
			dir: "./pages",
			style: "nextjs",
			handler: "./index.html",
			prefix: "/react",
			public: "./public",
		},
		{
			name: "api",
			mode: "node-handler",
			handler: "./api-handler.tsx",
			prefix: "/api",
			build: "simple-http",
		},
		{
			name: "web-api-handler",
			mode: "handler",
			handler: "./web-api-handler.tsx",
			prefix: "/web-api",
			build: "simple-http-web",
		},
		{
			name: "react-ssr-web",
			mode: "handler",
			handler: "./ssr-web-handler.tsx",
			build: "react-ssr-web",
			prefix: "/web-ssr",
			style: "nextjs",
			dir: "./pages",
		},
		{
			name: "react-ssr",
			mode: "node-handler",
			handler: "./ssr-handler.tsx",
			build: "react-ssr",
			prefix: "/ssr",
			style: "nextjs",
			dir: "./pages",
		},
		{
			name: "solid-ssr",
			mode: "node-handler",
			handler: "./solid/ssr-handler.tsx",
			build: "solid-ssr-node",
			prefix: "/solid-ssr",
			style: "nextjs",
			dir: "./solid-router/pages",
		},
		{
			name: "solid-client",
			mode: "build",
			handler: "./solid/ssr-client.tsx",
			build: "solid-client",
			prefix: "/_solid-pages",
			style: "nextjs",
			dir: "./solid-router/pages",
		},
		{
			name: "react-ssr-2",
			mode: "node-handler",
			handler: "./ssr-handler.tsx",
			build: "react-ssr",
			prefix: "/ssr-2",
			style: "nextjs",
			dir: "./pages",
		},
	],
});

if (process.argv.includes("--build")) {
	await app.build();
}

if (process.argv.includes("--serve") || process.argv.includes("--dev")) {
	await app.serve({
		port: 3000,
		dev: process.argv.includes("--dev"),
	});
}
```

