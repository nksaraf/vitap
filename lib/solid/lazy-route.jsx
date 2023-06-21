/// <reference types="vite/client" />

/** @jsxImportSource solid-js */
import { Link, Style } from "@solidjs/meta";
import {
	createComponent,
	lazy,
	onCleanup, // createElement,
	// forwardRef,
	// lazy,
	// useLayoutEffect,
} from "solid-js";

const assetMap = {
	style: ({ dangerouslySetInnerHTML, ...props }) => (
		<Style {...props}>{dangerouslySetInnerHTML.__html}</Style>
	),
	link: Link,
};

export default function lazyRoute(id, clientManifest, serverManifest) {
	return lazy(async () => {
		if (import.meta.env.DEV) {
			let manifest = import.meta.env.SSR ? serverManifest : clientManifest;
			const { default: Component } = await import(
				/* @vite-ignore */ manifest.inputs[id].output.path
			);
			let assets = await clientManifest.inputs?.[id].assets();
			const styles = assets.filter((asset) => asset.tag === "style");
			if (typeof window !== "undefined" && import.meta.hot) {
				import.meta.hot.on("css-update", (data) => {
					let styleAsset = styles.find(
						(s) => s["data-vite-dev-id"] === data.file,
					);
					if (styleAsset) {
						styleAsset.dangerouslySetInnerHTML.__html = data.contents;
					}

					for (const el of document.querySelectorAll(
						`style[data-vite-dev-id="${data.file}"]`,
					)) {
						el.innerHTML = data.contents;
					}
				});
			}

			const Comp = (props) => {
				console.log("rendering", props, assets);
				if (typeof window !== "undefined") {
					styles.forEach((style) => {
						let element = document.head.querySelector(
							`style[data-vite-dev-id="${style["data-vite-dev-id"]}"]`,
						);
						if (!element) {
							element = document.createElement("style");
							element.setAttribute(
								"data-vite-dev-id",
								style["data-vite-dev-id"],
							);
							element.innerHTML = style.dangerouslySetInnerHTML.__html;
							document.head.appendChild(element);
						}
					});
				}

				onCleanup(() => {
					// remove style tags added by vite when a CSS file is imported
					styles.forEach((style) => {
						let element = document.head.querySelector(
							`style[data-vite-dev-id="${style["data-vite-dev-id"]}"]`,
						);
						if (element) {
							element.remove();
						}
					});
				});
				return [
					...assets.map(({ tag, key, ...props }) =>
						createComponent(assetMap[tag], props),
					),
					createComponent(Component, props),
				];
				// Fragment,
				// null,
				// ...assets.map(({ tag: Asset, key, ...props }) => (
				// 	<Asset key={key} {...props} />
				// )),
				// createElement(Component, { ...props, ref: ref }),
				// );
			};
			return { default: Comp };
		} else {
			let manifest = import.meta.env.SSR ? serverManifest : clientManifest;
			const { default: Component } = await import(
				/* @vite-ignore */ manifest.inputs[id].output.path
			);
			let assets = await clientManifest.inputs?.[id].assets();
			console.log(assets);
			const Comp = (props) => {
				return [
					...assets.map(({ tag, key, ...props }) =>
						createComponent(assetMap[tag], props),
					),
					createComponent(Component, props),
				];
				// return createElement(
				// 	Fragment,
				// 	null,
				// 	...assets.map(({ tag: Asset, key, ...props }) => (
				// 		<Asset key={key} {...props} />
				// 	)),
				// 	createElement(Component, { ...props, ref: ref }),
				// );
			};
			return { default: Comp };
		}
	});
}
