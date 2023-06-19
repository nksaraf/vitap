import { join } from "pathe";

const manifest = new Proxy(
	{},
	{
		get(target, bundlerName) {
			return {
				inputs: new Proxy(
					{},
					{
						get(target, input) {
							let outputPath = import.meta.env.DEV
								? join(import.meta.env.BASE_URL, "@fs", input)
								: window.manifest[input].output;
							return {
								async assets() {
									if (import.meta.env.DEV) {
										const assetsPath =
											join(
												import.meta.env.BASE_URL,
												`__bundler/${bundlerName}/${Date.now()}/assets`,
											) + `?id=${input}`;
										return (await import(/* @vite-ignore */ assetsPath))
											.default;
									} else {
										return window.manifest[input].assets;
									}
								},
								output: {
									path: outputPath,
								},
							};
						},
					},
				),
			};
		},
	},
);
export default manifest;
