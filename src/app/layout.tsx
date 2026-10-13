import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

export const metadata: Metadata = { title: "CAW" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        {/* Ant Design's server-side style extraction; it only emits styles for the Ant components a route renders. */}
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
