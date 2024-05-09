import Bun from "bun";

await Bun.build({
  entrypoints: ["./phoenix/index.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
});
