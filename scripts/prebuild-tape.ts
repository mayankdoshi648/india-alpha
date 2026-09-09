import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSnapshot } from "../lib/engine";
import { withoutCharts } from "../lib/payload";
import type { UniverseId } from "../lib/types";

async function bake(universe: UniverseId) {
  const started = Date.now();
  const snap = await buildSnapshot(universe, undefined, { live: false });
  const slim = withoutCharts(snap);
  const json = JSON.stringify(slim);
  const out = join("public", "data", `${universe}.json`);
  writeFileSync(out, json);
  const mb = (json.length / 1_048_576).toFixed(2);
  console.log(`baked ${universe}: ${slim.stocks.length} names, ${mb} MB, ${Date.now() - started}ms`);
}

async function main() {
  mkdirSync(join("public", "data"), { recursive: true });
  await bake("nifty50");
  await bake("nifty500");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
