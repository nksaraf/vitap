import React from "react";

export default function App({ children }) {
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
