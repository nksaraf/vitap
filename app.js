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
