import wasm from 'harfbuzz-upstream/hb.wasm';
import hbjs from 'harfbuzz-upstream/hbjs.js';
import createHarfBuzz from './loader.cjs';
import callback0 from './callback-iiiii.wasm';
import callback1 from './callback-vi.wasm';
import callback2 from './callback-viiiffffffi.wasm';
import callback3 from './callback-viiiffffi.wasm';
import callback4 from './callback-viiiffi.wasm';
import callback5 from './callback-viiii.wasm';

// Workers accepts precompiled modules, never runtime compilation of callback bytes.
const callbackModules = {
	iiiii: callback0,
	vi: callback1,
	viiiffffffi: callback2,
	viiiffffi: callback3,
	viiiffi: callback4,
	viiii: callback5
};
export default createHarfBuzz({
	callbackModules,
	instantiateWasm(imports, receiveInstance) {
		receiveInstance(new WebAssembly.Instance(wasm, imports), wasm);
	}
}).then(hbjs);
