import Bun from "bun";

const result = await Bun.build({
  entrypoints: ["./phoenix/index.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
});

if (!result.success) {
  console.error(result);
  throw Error("Encountered an error during build.");
}
