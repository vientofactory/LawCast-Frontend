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

## Default share image

`lawcast-blueprint.png` is the shared 1200×630 Open Graph and Twitter card
image. `SeoHead.svelte` resolves its URL against the canonical page origin.
Pages that explicitly pass `image`, including bill details, keep that override.
The default image metadata is rendered during SSR, not injected after hydration.

The editable `lawcast-blueprint.svg` adapts the previously selected LawCast X
cover (the light blueprint design) to this aspect ratio without stretching or
cropping the brand lockup. It reuses the original brand vector paths and the
Pretendard caption outlined from `fonts/Pretendard-Regular.otf`; no runtime
font or external image dependency is required.

After editing the SVG, regenerate the committed PNG from the frontend directory:

```sh
node scripts/generate-default-og-image.mjs
```

The generator uses the existing `@cf-wasm/resvg` dependency; it does not run on
page requests or require an additional build step.
