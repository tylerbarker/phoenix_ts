# phoenix_ts

`phoenix_ts` is, first and foremost, an experiment and a learning exercise. It is an attempt to port the JS library bundled with the Phoenix web framework to TypeScript using Bun, and as few dependencies as possible.

The first goal is to port the existing test suite to be compatible with `bun:test` and have it pass with the existing JavaScript. From there, I'll port each module to TypeScript.

## Docs

To install dependencies:

```bash
bun install
```

To build:

```bash
bun run build
```

We run the tests only against the generated JavaScript - so you must build the project before running the suite. Once that's done, run the tests:

```bash
bun test
```

This project was created using `bun init` in bun v1.1.7. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
