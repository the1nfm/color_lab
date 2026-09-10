use crate::gamut::clip;
use crate::types::{Lab, Rgb};

fn rgb_linear(channel: f64) -> f64 {
    let channel1 = channel / 255.0;
    if channel1 >= 0.04045 {
        let value = ((channel1 + 0.055) / 1.055).powf(2.4);
        return value;
    } else {
        return channel1 / 12.92;
    }
}

fn xyz_cielab(channel: f64) -> f64 {
    if channel >= 0.008856 {
        return channel.cbrt();
    } else {
        return channel * 7.787 + (16.0 / 116.0);
    }
}

pub fn rgb_to_lab(rgb: Rgb) -> Lab {
    let rn = rgb_linear(rgb.r) * 100.0;
    let gn = rgb_linear(rgb.g) * 100.0;
    let bn = rgb_linear(rgb.b) * 100.0;

    let x = 0.412453 * rn + 0.357580 * gn + 0.180423 * bn;
    let y = 0.212671 * rn + 0.715160 * gn + 0.072169 * bn;
    let z = 0.019334 * rn + 0.119193 * gn + 0.950227 * bn;

    let fx = xyz_cielab(x / 95.047);
    let fy = xyz_cielab(y / 100.0);
    let fz = xyz_cielab(z / 108.883);

    let l = 116.0 * fy - 16.0;
    let a = 500.0 * (fx - fy);
    let b = 200.0 * (fy - fz);

    let k = Lab::new(l, a, b);
    return k;
}

fn cielab_xyz(channel: f64) -> f64 {
    let channel3 = channel.powf(3.0);

    if channel3 >= 0.008856 {
        return channel3;
    } else {
        return (channel - 16.0 / 116.0) / 7.787;
    }
}

fn linear_rgb(channel: f64) -> f64 {
    if channel >= 0.0031308 {
        return 1.055 * channel.powf(1.0 / 2.4) - 0.055;
    } else {
        return 12.92 * channel;
    }
}

pub fn lab_to_rgb(lab: Lab) -> (Rgb, bool) {
    let fy = (lab.l + 16.0) / 116.0;
    let fx = lab.a / 500.0 + fy;
    let fz = fy - lab.b / 200.0;

    let x = cielab_xyz(fx) * 95.047;
    let y = cielab_xyz(fy) * 100.0;
    let z = cielab_xyz(fz) * 108.883;

    let rn = 3.2406 * (x / 100.0) - 1.5372 * (y / 100.0) - 0.4986 * (z / 100.0);
    let gn = -0.9689 * (x / 100.0) + 1.8758 * (y / 100.0) + 0.0415 * (z / 100.0);
    let bn = 0.0557 * (x / 100.0) - 0.2040 * (y / 100.0) + 1.0570 * (z / 100.0);

    let raw_r = linear_rgb(rn) * 255.0;
    let raw_g = linear_rgb(gn) * 255.0;
    let raw_b = linear_rgb(bn) * 255.0;

    let (r, r_clamped) = clip(raw_r, 0.0, 255.0);
    let (g, g_clamped) = clip(raw_g, 0.0, 255.0);
    let (b, b_clamped) = clip(raw_b, 0.0, 255.0);

    let clamped = r_clamped || g_clamped || b_clamped;

    return (Rgb::new(r, g, b), clamped);
}
