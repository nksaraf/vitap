import React, { Suspense, lazy } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

const Text = lazy(async () => {
	await new Promise((r) => setTimeout(r, 1000));
	return {
		default: function Text() {
			return <div>Text</div>;
		},
	};
});

export default async function hello(event, context) {
	const htmlStream = await renderToReadableStream(
		<html>
			<head></head>
			<body>
				Hello world
				<Suspense>
					<Text />
				</Suspense>
			</body>
		</html>,
	);

	return new Response(htmlStream, {
		headers: {
			"content-type": "text/html",
		},
	});
}
