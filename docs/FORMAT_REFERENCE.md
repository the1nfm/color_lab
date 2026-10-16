# Какие поля извлекаются и что они означают

## Общие характеристики

Имя/путь: File.name или путь обхода выбранной папки. Размер файла в байтах берётся из File.size и используется для проверки диапазонов. Геометрия — число пикселей по двум осям, не физический размер. DPI X/Y — число пикселей на дюйм (формулировка задания dot/inch); к разрешению монитора эта величина отношения не имеет. Без единиц нельзя выдумать абсолютный DPI.

Глубина в таблице — число бит кодирования одного пикселя до сжатия, включая alpha/дополнительные samples. Для палитрового файла — число бит индекса, а не число бит в RGB записи палитры. Для JPEG — precision × components; изображение часто хранит YCbCr, а не RGB, subsampling отдельно меняет размер потока, но не эту показанную номинальную глубину.

Метод сжатия характеризует алгоритм хранения потока, а не размер файла/коэффициент сжатия. Программа его не вычисляет по размерам.

## BMP

BITMAPFILEHEADER: BM в байтах 0–1; bfSize DWORD LE по 2; bfOffBits DWORD LE по 10. DIB начинается по 14. Поддержаны CORE 12 и Windows DIB 40/52/56/108/124.

Для BITMAPINFOHEADER: biWidth по DIB+4; signed biHeight по +8 (модуль — высота, знак — направление строк); biPlanes по +12; biBitCount по +14; biCompression по +16; biSizeImage по +20; biXPelsPerMeter/biYPelsPerMeter по +24/+28; biClrUsed по +32.

DPI = pixelsPerMeter × 0.0254, поскольку дюйм равен 0.0254 метра. Неположительные значения трактуются как отсутствие абсолютной плотности.

BI_RGB=0 — без сжатия; BI_RLE8=1 и BI_RLE4=2 — серии одинаковых индексов для 8- и 4-битных изображений; BI_BITFIELDS=3 — маски компонент, не самостоятельный алгоритм сжатия. BI_JPEG=4, BI_PNG=5 — встроенный поток соответствующего формата.

Палитра Windows DIB — RGBQUAD (B,G,R,reserved), CORE — RGBTRIPLE (B,G,R). Количество берётся из biClrUsed; для bpp<=8 и biClrUsed=0 — 2^bpp. Значение пикселя индексирует элемент палитры. Строки несжатого BMP выравниваются до 4 байт: stride = ceil(width*bpp/32)*4.

Источник: Microsoft BITMAPINFOHEADER: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-bitmapinfoheader

## PNG

Сигнатура: 89 50 4E 47 0D 0A 1A 0A. Чанк: length U32 BE, type 4 bytes, data, CRC U32 BE. Смещение следующего: current+12+length.

IHDR: width/height U32 BE, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod. BitDepth — отсчёт компоненты или индекс, не автоматически bpp. Каналов: grayscale=1, RGB=3, indexed=1, gray+alpha=2, RGBA=4. Для RGB8 глубина 24, для RGBA8 — 32, indexed8 — 8.

CompressionMethod=0 — DEFLATE в zlib. FilterMethod=0 — адаптивная фильтрация строк с пятью типами фильтров, а не «фильтрация отсутствует». Конкретный фильтр каждой строки находится в распакованном потоке и здесь не извлекается. Interlace 0/1 — обычное хранение / Adam7.

pHYs: X,Y U32 BE и unit. unit=1 означает pixels/metre, DPI=value×0.0254; unit=0 даёт только отношение, не абсолютный DPI. PLTE: RGB triples, count=length/3. IEND имеет нулевую длину; CRC считается по type+data, не включая length.

Источник: W3C PNG Third Edition: https://www.w3.org/TR/png-3/

## JPEG

SOI FF D8. В заголовочной части маркер FF xx, затем длина U16 BE (включает свои два байта, не маркер). APP и другие неизвестные сегменты пропускаются по длине. SOF: precision, height U16 BE, width U16 BE, component count и по три байта описания компоненты. SOS начинает сжатые данные. EOI FF D9 обозначает конец.

APP0 JFIF: identifier JFIF\0, version, units, Xdensity, Ydensity, thumbnail sizes. units=0 — отношение; 1 — pixels/inch; 2 — pixels/cm, умножаем на 2.54. APP1 Exif\0\0 содержит TIFF header/IFD0. Из него читаются XResolution, YResolution, ResolutionUnit; EXIF переопределяет JFIF независимо от порядка этих APP-сегментов. EXIF Orientation здесь не применяется: геометрия из SOF, не повёрнутый размер отображения.

Сжатие уточняется по SOF: baseline/progressive DCT, Huffman/arithmetic, lossless. Это не утверждение, что любой JPEG имеет потери. DQT (матрицы квантования) в этой версии пропускается и не отображается.

Источник JFIF: https://www.w3.org/Graphics/JPEG/jfif3.pdf

## GIF

GIF87a/GIF89a, затем Logical Screen Descriptor. Width/Height U16 LE по абсолютным смещениям 6/8. Packed byte по 10: старший бит — наличие global table; младшие 3 бита N — размер 2^(N+1); биты 4–6 — Color Resolution, это характеристика исходного цветового устройства, НЕ глубина индекса палитры.

Каждый Image Descriptor может иметь собственную local table. В основной таблице приложения показывается максимальная глубина индекса среди кадров; в подробностях — набор глубин. Использование одинакового столбца для кадров разной глубины — выбранная сводная договорённость. Размер основного изображения — logical screen/canvas.

Компрессия LZW. Палитра содержит RGB triples. Absolute DPI отсутствует; Pixel Aspect Ratio при ненулевом значении задаёт (value+15)/64, то есть отношение ширины пикселя к высоте. Trailer=3B. Сжатые данные и extensions представлены подблоками с однобайтной длиной; нулевая длина завершает цепочку.

Источник GIF89a: https://www.w3.org/Graphics/GIF/spec-gif89a.txt

## TIFF

Classic TIFF: II (LE) или MM (BE), magic 42, смещение первого IFD U32. IFD: количество entries U16, entries по 12 bytes, next IFD U32. Entry: tag U16, type U16, count U32, value-or-offset 4 bytes. Если typeSize*count<=4, значение inline; иначе эти четыре байта — смещение от начала TIFF контейнера. В JPEG EXIF отсчёт от TIFF header после Exif\0\0, не от начала JPEG.

Основные tags: 256 ImageWidth, 257 ImageLength, 258 BitsPerSample, 259 Compression, 262 PhotometricInterpretation, 273 StripOffsets, 277 SamplesPerPixel, 279 StripByteCounts, 282/283 X/YResolution, 296 ResolutionUnit, 320 ColorMap, 324/325 TileOffsets/TileByteCounts.

BitsPerSample обычно SHORT-массив: RGB [8,8,8] → 24. RATIONAL — два U32: numerator/denominator. ResolutionUnit 2 → inch, 3 → cm (×2.54), 1 → абсолютная единица не задана. Для baseline default ResolutionUnit=2; default BitsPerSample=1, SamplesPerPixel=1, Compression=1. Один BitsPerSample для нескольких samples принимается как одинаковая глубина; это tolerant handling, а не доказательство строгой корректности структуры.

Compression: 1 none, 2 CCITT RLE, 3/4 Group 3/4, 5 LZW, 6 old JPEG, 7 JPEG, 8/32946 DEFLATE, 32773 PackBits. ColorMap содержит три массива 16-битных значений R,G,B; count/3 — число записей. Цепочка IFD даёт страницы. Проверяются диапазоны полос/плиток всех просмотренных страниц, метаданные выводятся только для первой.

Источник TIFF 6.0: https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf

## PCX

128-byte header: Manufacturer=0A по 0, Version по 1, Encoding по 2 (0 none, 1 RLE), BitsPerPixel по 3 (на плоскость!), xmin/ymin/xmax/ymax U16 LE по 4/6/8/10; H/Vdpi U16 LE по 12/14; palette 16 RGB entries по 16; planes по 65; BytesPerLine U16 LE по 66.

Width=xmax-xmin+1, height=ymax-ymin+1. Bpp=bitsPerPlane*planes, RGB8×3 →24. BytesPerLine относится к одной плоскости; декодированная строка занимает BytesPerLine*planes, включая padding. Для version=5, 8 bits, 1 plane в конце обычно marker 0C и 768 bytes (256 RGB entries); этот режим требует такой палитры. Старые версии/монохромные режимы используют данные заголовка иначе.

PCX RLE: старшие два бита байта 11 означают повторение (младшие 6 — count), следующий байт — значение; иначе байт literal. Здесь поток не декодируется. H/Vdpi выводятся как заявленные поля, но их историческая интерпретация неоднозначна: разные программы могли записывать размеры или плотность.

Источник: https://www.fileformat.info/format/pcx/egff.htm
