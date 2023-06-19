/** @jsxImportSource solid-js */
import { A } from "@solidjs/router";

import "./hello.css";

// function Counter() {
// 	return (
// 		<div>
// 			<p>Count: {count}</p>
// 			<button onClick={() => setCount(count + 1)}>Increment</button>
// 		</div>
// 	);
// }

export default function Hello({ assets }) {
	return (
		<>
			<div>Hellsd4</div>
			<A href="/hello">Hello</A>
			{/* <iframe
				src="/_spa/hello"
				style={{
					width: 400,
					height: 300,
				}}
			/>
			<iframe
				src="/hello"
				style={{
					width: 400,
					height: 300,
				}} */}
			{/* /> */}
		</>
	);
}
