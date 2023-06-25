import { AsyncLocalStorage } from "async_hooks";
import colors from "picocolors";
import { isMainThread } from "worker_threads";

const logContext = new AsyncLocalStorage();
let prevLog = console.log.bind(console);
console.log = (...args) => {
	const req = logContext.getStore();
	if (!req) {
		prevLog(...args);
		return;
	}
	prevLog(
		`${colors.dim(`${colors.blue(req.router.name)}:${isMainThread ? '' : 'worker:'}${req.requestId}`)}`,
		...args,
	);
};
export let requestIdCounter = 0;
export function withLogger(logger, fn) {
	return logContext.run(logger, fn);
}
