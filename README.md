# phoenix_ts

`phoenix_ts` is, first and foremost, an experiment and a learning exercise. It's an attempt to port the JS library bundled with the Phoenix web framework (as of v1.7.14) to TypeScript. Bundled and tested with [Bun](https://bun.sh).

I'll be doing the same for `phoenix_live_view` in a separate repo at a later date. Great timing actually, as they just announced [a release candidate for v1.0](https://github.com/phoenixframework/phoenix_live_view/commit/d84b19c9761c8a665084a05178dfbd6de8acd6e8)!

This effort isn't officially endorsed by the Phoenix team, just a bit of fun. That being said, I would love it if this or a similar effort was eventually integrated into the Phoenix project. Personally, I think it'd be easier to maintain, extend, and consume the framework if the JS clients were written in TypeScript and shipped types.

## TODO

- [x] Port the Mocha test suite to Bun test (3x speedup!)
- [x] Port util.js to TypeScript
- [x] Port constants.js to TypeScript
- [x] Port index.js to TypeScript
- [x] Port ajax.js to TypeScript
- [x] Port timer.js to TypeScript
- [x] Port serializer.js to TypeScript
- [x] Port push.js to TypeScript
- [x] Port longpoll.js to TypeScript
- [ ] Port presence.js to TypeScript
- [ ] Port channel.js to TypeScript
- [ ] Port socket.js to TypeScript
- [ ] Circle back to `any` types after everything is ported
- [ ] Circle back to `as` type assertions after everything is ported
- [ ] Reassess bundling targets e.g what do we need to support?
- [ ] Configure as Hex package (minimal Elixir scaffolding)
- [ ] Write installation documentation

## Staying Up to Date

Current Version: v1.7.14

I intend to release a corresponding version of this library for each Phoenix release from v1.7.12 onwards, even if the bundled JS does not change to assure compatibility.

I've written a script - to be run every day by a GH Action - which:

1. Checks the Phoenix repo for releases newer than our current version.
2. If a new release is found, it raises an issue on this repo with details of any changes to the Phoenix `assets/` repo if they are present.

See `phx-changes-check.ts`.

## Development

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
