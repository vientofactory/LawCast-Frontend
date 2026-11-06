# HarfBuzz workerd integration

Uses the upstream HarfBuzz 0.10.0 API and WASM with precompiled static callback bridges for every signature in upstream hbjs.js. The vendored Emscripten loader disables environment-based file fetching and replaces runtime callback compilation with an injected module map. Node uses the original upstream entry point. Binary bridge modules import and re-export a function of the declared signature; they contain no application logic. No runtime WASM compilation, eval or network loading is used on workerd.
