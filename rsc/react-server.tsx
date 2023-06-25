import type { HandlerContext } from "../lib/types";
import App from "../ssr-app";
import * as ReactServerDOM from "react-server-dom-vite/server";
import { renderAsset } from "../lib/react/render-asset";
import Counter from "../Counter";

export default async (event, response, context: HandlerContext) => {
  const { manifest } = context;

  // if (!context.match) {
  // 	throw new Error(`Path ${event.request.url} did not match any route`);
  // }

  // const Route = lazyRoute(
  // 	context.match.filePath,
  // 	manifest["react-rsc-client"],
  // 	manifest[context.router.name],
  // );

  // const manifestJSON = await manifest["react-rsc-client"].json();

  // const htmlStream = await renderToReadableStream(
  //   <App>
  //     {assets.map(({ tag: Tag, key, ...props }) => (
  //       <Tag key={key} {...props} />
  //     ))}
  //     {/* <Router
  // 			ssrPath={new URL(event.request.url).pathname}
  // 			base={import.meta.env.BASE_URL}
  // 		>
  // 			<Route />
  // 		</Router> */}
  //   </App>,
  //   {
  //     bootstrapModules: [
  //       manifest["react-rsc-client"]?.inputs["./rsc-ssr-client.tsx"].output
  //         .path,
  //     ].filter(Boolean) as string[],
  //     bootstrapScriptContent: `
  // 		window.base = "${import.meta.env.BASE_URL}"
  // 		window.manifest = ${JSON.stringify(manifestJSON)};`,
  //   }
  // );

  const clientManifest = manifest["react-rsc-client"];
  const assets = await clientManifest?.inputs[clientManifest.handler].assets();

  const { pipe } = ReactServerDOM.renderToPipeableStream(
    <App>
      {assets.map(renderAsset)}
      <div>Hello World</div>
      <Counter />
    </App>
  );

  pipe(response);
};
