mod gamut;
mod lab_cmyk;
mod rgb_lab;
pub mod types;

use wasm_bindgen::prelude::*;

use crate::lab_cmyk::{
    cmyk_to_lab as convert_cmyk_to_lab,
    lab_to_cmyk as convert_lab_to_cmyk,
};

use crate::rgb_lab::{
    lab_to_rgb as convert_lab_to_rgb,
    rgb_to_lab as convert_rgb_to_lab,
};

use crate::types::{Cmyk, Lab, Rgb};

#[derive(serde::Serialize)]
struct RgbWithGamut {
    r: f64,
    g: f64,
    b: f64,
    clamped: bool,
}

#[derive(serde::Serialize)]
struct CmykWithGamut {
    c: f64,
    m: f64,
    y: f64,
    k: f64,
    clamped: bool,
}

fn to_js_value<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value)
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen(js_name = rgbToLab)]
pub fn rgb_to_lab_wasm(r: f64, g: f64, b: f64) -> Result<JsValue, JsValue> {
    let lab = convert_rgb_to_lab(Rgb::new(r, g, b));
    to_js_value(&lab)
}

#[wasm_bindgen(js_name = labToRgb)]
pub fn lab_to_rgb_wasm(l: f64, a: f64, b: f64) -> Result<JsValue, JsValue> {
    let (rgb, clamped) = convert_lab_to_rgb(Lab::new(l, a, b));

    to_js_value(&RgbWithGamut {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        clamped,
    })
}

#[wasm_bindgen(js_name = labToCmyk)]
pub fn lab_to_cmyk_wasm(l: f64, a: f64, b: f64) -> Result<JsValue, JsValue> {
    let (cmyk, clamped) = convert_lab_to_cmyk(Lab::new(l, a, b));

    to_js_value(&CmykWithGamut {
        c: cmyk.c,
        m: cmyk.m,
        y: cmyk.y,
        k: cmyk.k,
        clamped,
    })
}

#[wasm_bindgen(js_name = cmykToLab)]
pub fn cmyk_to_lab_wasm(c: f64, m: f64, y: f64, k: f64) -> Result<JsValue, JsValue> {
    let lab = convert_cmyk_to_lab(Cmyk::new(c, m, y, k));
    to_js_value(&lab)
}