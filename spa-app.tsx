import React from "react";

export default function App({ children }) {
	return (
		<>
			SPA
			<a href="/">Main Home</a>
			{children}
		</>
	);
}
