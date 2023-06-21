/** @jsxImportSource solid-js */

export default function App({ children, head }) {
	return (
		<html>
			<head></head>
			<body>
				SSR
				<a href="/_spa/hello">Main Home</a>
				{children}
			</body>
		</html>
	);
}
