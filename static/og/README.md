# static/og — OG image assets

Runtime assets for the dynamic bill Open Graph image (`/notices/[num]/og.png`,
rendered by `src/lib/server/og-image.ts`). The renderer fetches them from our
own origin in every runtime (Vite dev server and Cloudflare Pages) —
filesystem reads do not work on Workers.

| File                              | Source                                                                                                                                                                              | License                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `fonts/Pretendard-Regular.otf`     | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) `examples/flutter_pretendard/fonts/Pretendard-Regular.otf` (Pretendard Regular, full Hangul coverage)               | SIL Open Font License 1.1 — copy in `fonts/LICENSE.txt` |

**No `.wasm` files belong here.** The renderer uses `@cf-wasm/satori` and
`@cf-wasm/resvg`, which import their WASM as static ESM modules that wrangler
pre-compiles at deploy — Cloudflare Workers forbids compiling WASM from raw
bytes at runtime, so shipping a `.wasm` binary for fetch-and-instantiate (the
obvious approach) cannot work on this platform.
