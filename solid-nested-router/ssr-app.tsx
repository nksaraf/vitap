/** @jsxImportSource solid-js */
import { A } from "@solidjs/router";

export default function App({ children, head }) {
	return (
		<html>
			<head></head>
			<body>
				SSR
				<A href="/">Main Home</A>
				<A href="/hello">hello</A>
				<A href="/yo/abc">yo abc</A>
				<A href="/yo/ab">yo ab</A>
				{children}
			</body>
		</html>
	);
}
