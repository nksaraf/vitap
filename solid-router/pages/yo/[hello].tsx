import { useParams } from "@solidjs/router";

export default function Page() {
  const params = useParams();
  console.log(params);
  return <div>Hello Yo {params.hello}</div>;
}
