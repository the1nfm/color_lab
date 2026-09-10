use serde::Serialize;

#[derive(Clone, Copy, Serialize)]
pub struct Rgb {
    pub r: f64,
    pub g: f64,
    pub b: f64,
}

impl Rgb {
    pub fn new(red: f64, green: f64, blue: f64) -> Self {
        Self {
            r: (red),
            g: (green),
            b: (blue),
        }
    }
}
#[derive(Clone, Copy, Serialize)]
pub struct Lab {
    pub l: f64,
    pub a: f64,
    pub b: f64,
}

impl Lab {
    pub fn new(light: f64, ac: f64, bc: f64) -> Self {
        Self {
            l: (light),
            a: (ac),
            b: (bc),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Cmyk {
    pub c: f64,
    pub m: f64,
    pub y: f64,
    pub k: f64,
}

impl Cmyk {
    pub fn new(c: f64, m: f64, y: f64, k: f64) -> Self {
        Self { c, m, y, k }
    }
}
