import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { SampleDataMark } from "@/components/SampleDataMark";

export const metadata: Metadata = { title: "CAW" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        {/* Ant Design's server-side style extraction; it only emits styles for the Ant components a route renders. */}
        <SampleDataMark />
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
