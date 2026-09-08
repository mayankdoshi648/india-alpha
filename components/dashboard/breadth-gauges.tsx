"use client";

import type { BreadthCircle } from "@/lib/types";
import { Gauge, Panel } from "@/components/dashboard/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function BreadthGauges({ gauges }: { gauges: BreadthCircle[] }) {
  return (
    <Panel>
      <Tabs defaultValue="D">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Share of the selected universe trading above each EMA.
          </p>
          <TabsList>
            <TabsTrigger value="D">Daily</TabsTrigger>
            <TabsTrigger value="W">Weekly</TabsTrigger>
            <TabsTrigger value="M">Monthly</TabsTrigger>
          </TabsList>
        </div>
        {(["D", "W", "M"] as const).map((tf) => (
          <TabsContent key={tf} value={tf}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {gauges.map((g) => (
                <Gauge
                  key={g.period}
                  value={tf === "D" ? g.daily : tf === "W" ? g.weekly : g.monthly}
                  label={g.label}
                  hint={
                    g.role === "short"
                      ? "Short-term momentum"
                      : g.role === "medium"
                        ? "Medium-term momentum"
                        : "Long-term momentum"
                  }
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Panel>
  );
}
