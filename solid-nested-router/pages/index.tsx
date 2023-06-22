/** @jsxImportSource solid-js */
import { A } from "@solidjs/router";
import { createSignal } from "solid-js";

import "./hello.css";

function Counter() {
	const [count, setCount] = createSignal(0);

	return (
		<div>
			<button onClick={() => setCount(count() + 1)}>+</button>
			<span>{count()}</span>
			<button onClick={() => setCount(count() - 1)}>-</button>
		</div>
	);
}

export default function Hello({ assets }) {
	return (
		<>
			<div>Hellsd4</div>
			<A href="/hello">Hello world</A>
			<Counter />
			Yooooo123
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
