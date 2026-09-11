/* @ts-self-types="./rust_core.d.ts" */
import * as wasm from "./rust_core_bg.wasm";
import { __wbg_set_wasm } from "./rust_core_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    cmykToLab, labToCmyk, labToRgb, rgbToLab
} from "./rust_core_bg.js";
