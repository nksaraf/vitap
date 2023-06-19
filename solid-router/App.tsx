/** @jsxImportSource solid-js */
import { createSignal } from "solid-js";

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

export function App(props) {
	return (
		<div>
			Hello world! <Counter />
			{props.children}
		</div>
	);
}
