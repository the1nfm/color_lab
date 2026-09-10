const EPSILON: f64 = 0.01;

pub fn clip(value: f64, min: f64, max: f64) -> (f64, bool) {
    if value < min {
        if value >= min - EPSILON {
            (min, false)
        } else {
            (min, true)
        }
    } else if value > max {
        if value <= max + EPSILON {
            (max, false)
        } else {
            (max, true)
        }
    } else {
        (value, false)
    }
}
