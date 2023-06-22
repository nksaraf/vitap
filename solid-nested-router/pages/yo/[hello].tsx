import { useParams } from "@solidjs/router";

export default function Page() {
	const params = useParams();
	return <div>Hello Yo {params.hello}</div>;
}
