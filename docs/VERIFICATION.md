Проверки при подготовке исходного архива

Проверены package.json (JSON) и синтаксис шести обычных JS/MJS файлов через node --check: успешно.
Двенадцать неповреждённых контрольных изображений открыты независимым декодером. Это проверка фикстур, не приложения.
Rust/Cargo/wasm-pack отсутствуют: cargo test, wasm-pack build, Vite build и Playwright не выполнялись.
Архив преподавателя и стресс-тест 600 JPEG / 2 ГБ не проверялись.

Независимо проверенные свойства фикстур:
{
  "rgb.png": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "rgb.jpg": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "rgb.bmp": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "rgb.tif": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "rgb.pcx": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "palette.gif": {
    "width": 17,
    "height": 11,
    "mode": "P",
    "pages": 1
  },
  "big-endian.tif": {
    "width": 2,
    "height": 2,
    "mode": "L",
    "pages": 1
  },
  "rgba.png": {
    "width": 17,
    "height": 11,
    "mode": "RGBA",
    "pages": 1
  },
  "progressive.jpg": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "deflate.tif": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  },
  "multipage.tif": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 2
  },
  "exif.jpg": {
    "width": 17,
    "height": 11,
    "mode": "RGB",
    "pages": 1
  }
}
