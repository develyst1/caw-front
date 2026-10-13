// The projects page, for now only as far as proving the seam end to end: the mock's project name comes through `CawApi`.
import { Card } from "antd";
import Title from "antd/es/typography/Title"; // `Typography.Title` is not reachable from a server component (a client reference has no members)
import { api } from "@/api";
import { section } from "@/words";

export const dynamic = "force-dynamic"; // always asks the seam; the list changes as the back end does

export default async function Home() {
  const projects = await api.projects();
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>
      <Title level={1}>{section.projects}</Title>
      {/* no render-prop here: a server component cannot hand a function to an Ant (client) component */}
      {projects.map((p) => <Card key={p.id}>{p.name}</Card>)}
    </main>
  );
}
