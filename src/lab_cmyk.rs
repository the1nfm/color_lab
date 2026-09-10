use crate::rgb_lab::{lab_to_rgb, rgb_to_lab};
use crate::types::{Cmyk, Lab, Rgb};

fn rgb_to_cmyk(rgb: Rgb) -> Cmyk {
    let r = rgb.r / 255.0;
    let g = rgb.g / 255.0;
    let b = rgb.b / 255.0;

    let k = 1.0 - r.max(g).max(b);

    if k >= 1.0 {
        return Cmyk::new(0.0, 0.0, 0.0, 100.0);
    }

    let c = (1.0 - r - k) / (1.0 - k);
    let m = (1.0 - g - k) / (1.0 - k);
    let y = (1.0 - b - k) / (1.0 - k);

    Cmyk::new(c * 100.0, m * 100.0, y * 100.0, k * 100.0)
}

fn cmyk_to_rgb(cmyk: Cmyk) -> Rgb {
    let c = cmyk.c / 100.0;
    let m = cmyk.m / 100.0;
    let y = cmyk.y / 100.0;
    let k = cmyk.k / 100.0;

    let r = 255.0 * (1.0 - c) * (1.0 - k);
    let g = 255.0 * (1.0 - m) * (1.0 - k);
    let b = 255.0 * (1.0 - y) * (1.0 - k);

    Rgb::new(r, g, b)
}

pub fn lab_to_cmyk(lab: Lab) -> (Cmyk, bool) {
    let (rgb, clamped) = lab_to_rgb(lab);
    let cmyk = rgb_to_cmyk(rgb);

    (cmyk, clamped)
}

pub fn cmyk_to_lab(cmyk: Cmyk) -> Lab {
    let rgb = cmyk_to_rgb(cmyk);

    rgb_to_lab(rgb)
}
