# phoenix_ts

`phoenix_ts` is, first and foremost, an experiment and a learning exercise. It's an attempt to port the JS library bundled with the Phoenix web framework (as of v1.7.12) to TypeScript. Bundled and tested with [Bun](https://bun.sh).

I'll be doing the same for `phoenix_live_view` in a separate repo at a later date. Great timing actually, as they just announced [a release candidate for v1.0](https://github.com/phoenixframework/phoenix_live_view/commit/d84b19c9761c8a665084a05178dfbd6de8acd6e8)!

This effort isn't officially endorsed by the Phoenix team, just a bit of fun. That being said, I would love it if this or a similar effort was eventually integrated into the Phoenix project. Personally, I think it'd be easier to maintain, extend, and consume the framework if the JS clients were written in TypeScript and shipped types.

## TODO

- [x] Port the Mocha test suite to Bun test (3x speedup!)
- [x] Port util.js to TypeScript
- [x] Port constants.js to TypeScript
- [x] Port index.js to TypeScript
- [ ] Port ajax.js to TypeScript
- [ ] Port channel.js to TypeScript
- [ ] Port longpoll.js to TypeScript
- [ ] Port presence.js to TypeScript
- [ ] Port socket.js to TypeScript
- [x] Port timer.js to TypeScript

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
