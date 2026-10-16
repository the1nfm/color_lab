use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use js_sys::{Function, Promise, Uint8Array};
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};

type Res<T> = Result<T, String>;
#[derive(Default, Serialize)]
struct Meta {
    format: String, width: Option<u32>, height: Option<u32>,
    dpi_x: Option<f64>, dpi_y: Option<f64>, depth: Option<u32>,
    compression: String, status: String, details: Vec<String>, warnings: Vec<String>,
}
impl Meta {
    fn new(f: &str) -> Self { Self { format:f.into(), status:"ok".into(), ..Self::default() } }
    fn dimensions(&mut self,w:u32,h:u32)->Res<()> {
        if w==0 || h==0 {return Err("Нулевой размер изображения".into());}
        self.width=Some(w);self.height=Some(h);Ok(())
    }
    fn dpi(&mut self,x:f64,y:f64) {
        if x.is_finite() && x>0. {self.dpi_x=Some(x);}
        if y.is_finite() && y>0. {self.dpi_y=Some(y);}
    }
}
struct Reader {size:u64, callback:Function}
impl Reader {
    fn bounds(&self,p:u64,n:u64)->Res<()> {
        if p.checked_add(n).is_none_or(|end|end>self.size) {Err(format!("Выход за границы: смещение {p}, длина {n}, размер {}",self.size))} else {Ok(())}
    }
    async fn get(&self,p:u64,n:usize)->Res<Vec<u8>> {
        self.bounds(p,n as u64)?;
        if n>1_048_576 {return Err("Лимит одного чтения метаданных: 1 МиБ".into());}
        let value=self.callback.call2(&JsValue::NULL,&JsValue::from_f64(p as f64),&JsValue::from_f64(n as f64))
            .map_err(|_|"Ошибка вызова чтения".to_string())?;
        let value=JsFuture::from(Promise::resolve(&value)).await.map_err(|_|"Ошибка чтения файла".to_string())?;
        let a=Uint8Array::new(&value).to_vec();
        if a.len()!=n {return Err("Не удалось прочитать запрошенное число байтов".into());} Ok(a)
    }
}
fn u16_at(b:&[u8],p:usize,le:bool)->Res<u16> {
    let a:[u8;2]=b.get(p..p+2).ok_or("Обрезанное поле u16")?.try_into().map_err(|_|"u16")?;
    Ok(if le {u16::from_le_bytes(a)} else {u16::from_be_bytes(a)})
}
fn u32_at(b:&[u8],p:usize,le:bool)->Res<u32> {
    let a:[u8;4]=b.get(p..p+4).ok_or("Обрезанное поле u32")?.try_into().map_err(|_|"u32")?;
    Ok(if le {u32::from_le_bytes(a)} else {u32::from_be_bytes(a)})
}
fn crc32(b:&[u8])->u32 {
    let mut c=0xffff_ffffu32;
    for &v in b {c^=v as u32;for _ in 0..8 {c=(c>>1)^if c&1!=0 {0xedb8_8320}else{0};}}
    !c
}
fn detect(b:&[u8])->&'static str {
    if b.starts_with(b"\x89PNG\r\n\x1a\n") {"PNG"}
    else if b.starts_with(b"\xff\xd8") {"JPEG"}
    else if b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a") {"GIF"}
    else if b.starts_with(b"BM") {"BMP"}
    else if b.starts_with(b"II\x2a\0") || b.starts_with(b"MM\0\x2a") {"TIFF"}
    else if b.starts_with(b"II\x2b\0") || b.starts_with(b"MM\0\x2b") {"BigTIFF"}
    else if b.first()==Some(&10) {"PCX"} else {"Unknown"}
}

async fn png(r:&Reader)->Res<Meta> {
    let mut m=Meta::new("PNG");let mut p=8u64;let mut ihdr=false;let mut idat=false;
    let mut color=0u8;let mut palette=false;
    for _ in 0..200_000 {
        let h=r.get(p,8).await?;let n=u32_at(&h,0,false)? as u64;let typ=&h[4..8];
        if n>0x7fff_ffff {return Err("PNG: недопустимая длина чанка".into());}
        r.bounds(p,12+n)?;
        if !ihdr && typ!=b"IHDR" {return Err("PNG: первый чанк не IHDR".into());}
        if typ==b"IHDR" || typ==b"pHYs" || typ==b"PLTE" || typ==b"IEND" {
            if n>768 {return Err("PNG: неверная длина служебного чанка".into());}
            let b=r.get(p+4,n as usize+8).await?;
            if crc32(&b[..n as usize+4])!=u32_at(&b,n as usize+4,false)? {return Err("PNG: неверный CRC служебного чанка".into());}
            let d=&b[4..4+n as usize];
            match typ {
                b"IHDR"=>{
                    if ihdr || n!=13 {return Err("PNG: неверный IHDR".into());}
                    m.dimensions(u32_at(d,0,false)?,u32_at(d,4,false)?)?;
                    let depth=d[8];color=d[9];
                    let channels=match color {0|3=>1,2=>3,4=>2,6=>4,_=>return Err("PNG: неизвестный тип цвета".into())};
                    let valid=match color {0=>[1,2,4,8,16].contains(&depth),3=>[1,2,4,8].contains(&depth),_=>[8,16].contains(&depth)};
                    if !valid || d[10]!=0 || d[11]!=0 || d[12]>1 {return Err("PNG: неверные параметры IHDR".into());}
                    m.depth=Some(depth as u32*channels);m.compression="DEFLATE (zlib)".into();
                    m.details.push(format!("IHDR: глубина отсчёта/индекса {depth}; тип цвета {color}; метод фильтрации 0 (адаптивный); чересстрочность {}",d[12]));
                    ihdr=true;
                },
                b"pHYs"=>{
                    if n!=9 || d[8]>1 {return Err("PNG: неверный pHYs".into());}
                    let x=u32_at(d,0,false)?;let y=u32_at(d,4,false)?;
                    if d[8]==1 {m.dpi(x as f64*0.0254,y as f64*0.0254);} else {m.details.push(format!("pHYs: только отношение сторон пикселя {x}:{y}, не DPI"));}
                },
                b"PLTE"=>{if n==0 || n%3!=0 {return Err("PNG: неверная палитра".into());}palette=true;m.details.push(format!("PLTE: {} элементов RGB",n/3));},
                b"IEND"=>{
                    if n!=0 || !idat || (color==3 && !palette) {return Err("PNG: неполная структура".into());}
                    if p+12!=r.size {m.warnings.push("Данные после IEND".into());}return Ok(m);
                },_=>{}
            }
        } else if typ==b"IDAT" {idat=true;}
        p+=12+n;
    }
    Err("PNG: превышен лимит чанков".into())
}
async fn bmp(r:&Reader)->Res<Meta> {
    let h=r.get(0,26).await?;let declared=u32_at(&h,2,true)? as u64;let offset=u32_at(&h,10,true)? as u64;
    let dib=u32_at(&h,14,true)? as usize;
    if declared>r.size {return Err("BMP: размер меньше bfSize".into());}
    if ![12,40,52,56,108,124].contains(&dib) {return Err(format!("UNSUPPORTED:BMP: DIB {dib} (OS/2 и другие варианты не реализованы)"));}
    r.bounds(14,dib as u64)?;r.bounds(offset,0)?;
    if offset<14+dib as u64 {return Err("BMP: смещение пикселей внутри заголовка".into());}
    let d=r.get(14,dib).await?;let mut m=Meta::new("BMP");
    let (w,h,bits,comp,size,palette,planes)=if dib==12 {
        (u16_at(&d,4,true)? as u32,u16_at(&d,6,true)? as u32,u16_at(&d,10,true)? as u32,0,0,0,u16_at(&d,8,true)?)
    } else {
        let w=u32_at(&d,4,true)? as i32;let rawh=u32_at(&d,8,true)? as i32;
        let comp=u32_at(&d,16,true)?;
        if w<=0 || rawh==i32::MIN || (rawh<0 && ![0,3,6].contains(&comp)) {return Err("BMP: неверная геометрия".into());}
        m.dpi((u32_at(&d,24,true)? as i32) as f64*0.0254,(u32_at(&d,28,true)? as i32) as f64*0.0254);
        m.details.push(if rawh<0 {"Строки сверху вниз"} else {"Строки снизу вверх"}.into());
        (w as u32,rawh.unsigned_abs(),u16_at(&d,14,true)? as u32,comp,u32_at(&d,20,true)? as u64,u32_at(&d,32,true)? as u64,u16_at(&d,12,true)?)
    };
    if planes!=1 || ![1,4,8,16,24,32].contains(&bits) {return Err("BMP: неверные planes/bitCount".into());}
    if (comp==1 && bits!=8) || (comp==2 && bits!=4) || ([3,6].contains(&comp) && ![16,32].contains(&bits)) {return Err("BMP: сжатие не соответствует глубине".into());}
    m.dimensions(w,h)?;m.depth=Some(bits);
    m.compression=match comp {0=>"BI_RGB — без сжатия",1=>"BI_RLE8",2=>"BI_RLE4",3=>"BI_BITFIELDS — маски, не сжатие",4=>"BI_JPEG",5=>"BI_PNG",6=>"BI_ALPHABITFIELDS",_=>return Err(format!("UNSUPPORTED:BMP: compression={comp}"))}.into();
    if [0,3,6].contains(&comp) {
        let stride=(w as u64*bits as u64).div_ceil(32)*4;
        r.bounds(offset,stride*h as u64)?;
    } else if size>0 {r.bounds(offset,size)?;} else {return Err("BMP: для сжатого изображения отсутствует biSizeImage".into());}
    let entries=if bits<=8 {if palette==0 {1u64<<bits} else {palette}} else {palette};
    if bits<=8 && entries>(1u64<<bits) {return Err("BMP: слишком большая палитра".into());}
    let masks=if dib==40 && comp==3 {12} else if dib==40 && comp==6 {16} else {0};
    let palette_end=14+dib as u64+masks+entries*if dib==12 {3}else{4};
    if palette_end>offset {return Err("BMP: обрезанная палитра или маски".into());}
    if entries>0 {m.details.push(format!("Палитра: {entries} элементов {}; индекс пикселя выбирает цвет",if dib==12 {"BGR"}else{"BGR + резервный байт"}));}
    Ok(m)
}
async fn gif_blocks(r:&Reader,mut p:u64)->Res<u64> {
    for _ in 0..1_000_000 {
        let n=r.get(p,1).await?[0] as u64;p+=1;
        if n==0 {return Ok(p);}r.bounds(p,n)?;p+=n;
    }Err("GIF: лимит подблоков".into())
}
async fn gif(r:&Reader)->Res<Meta> {
    let h=r.get(0,13).await?;let mut m=Meta::new("GIF");m.dimensions(u16_at(&h,6,true)? as u32,u16_at(&h,8,true)? as u32)?;
    m.compression="LZW".into();let global=h[10]&128!=0;let gd=(h[10]&7)+1;
    let mut p=13u64;if global {let n=1u64<<gd;r.bounds(p,n*3)?;p+=n*3;m.details.push(format!("Глобальная палитра: {n} элементов RGB"));}
    m.details.push(format!("Color Resolution: {} бит/канал исходного устройства (не глубина индекса)",((h[10]>>4)&7)+1));
    if h[12]!=0 {m.details.push(format!("Отношение ширины пикселя к высоте: {:.4}; DPI в GIF не хранится",(h[12] as f64+15.)/64.));}
    let mut frames=0u32;let mut depths=HashSet::new();
    for _ in 0..200_000 {
        match r.get(p,1).await?[0] {
            0x3b=>{if frames==0 {return Err("GIF: нет кадров".into());}m.depth=depths.iter().max().copied();m.details.push(format!("Кадров: {frames}; глубины индексов: {depths:?}; размер — логический экран"));if p+1!=r.size {m.warnings.push("Данные после GIF trailer".into());}return Ok(m);},
            0x21=>{r.get(p+1,1).await?;p=gif_blocks(r,p+2).await?;},
            0x2c=>{
                let d=r.get(p+1,9).await?;let x=u16_at(&d,0,true)? as u32;let y=u16_at(&d,2,true)? as u32;
                let w=u16_at(&d,4,true)? as u32;let h=u16_at(&d,6,true)? as u32;
                if w==0 || h==0 || x+w>m.width.unwrap_or(0) || y+h>m.height.unwrap_or(0) {return Err("GIF: кадр вне логического экрана".into());}
                p+=10;let local=d[8]&128!=0;let depth=if local {(d[8]&7)+1}else{gd};
                if !local && !global {return Err("GIF: отсутствует таблица цветов".into());}
                if local {let n=3*(1u64<<depth);r.bounds(p,n)?;p+=n;}
                depths.insert(depth as u32);
                let lzw=r.get(p,1).await?[0];if !(2..=8).contains(&lzw) {return Err("GIF: неверный LZW minimum code size".into());}
                p=gif_blocks(r,p+1).await?;frames+=1;
            },_=>return Err("GIF: неизвестный блок или отсутствует trailer".into())
        }
    }Err("GIF: лимит блоков".into())
}
async fn pcx(r:&Reader)->Res<Meta> {
    let h=r.get(0,128).await?;
    if ![0,2,3,4,5].contains(&h[1]) || h[2]>1 || ![1,2,4,8].contains(&h[3]) || h[64]!=0 {return Err("PCX: неверный заголовок".into());}
    let xmin=u16_at(&h,4,true)?;let ymin=u16_at(&h,6,true)?;let xmax=u16_at(&h,8,true)?;let ymax=u16_at(&h,10,true)?;
    if xmax<xmin || ymax<ymin || h[65]==0 || h[65]>4 {return Err("PCX: неверная геометрия/число плоскостей".into());}
    let w=xmax as u32-xmin as u32+1;let height=ymax as u32-ymin as u32+1;
    let line=u16_at(&h,66,true)? as u64;let min=(w as u64*h[3] as u64).div_ceil(8);
    if line<min || line%2!=0 {return Err("PCX: неверный BytesPerLine".into());}
    let mut m=Meta::new("PCX");m.dimensions(w,height)?;m.depth=Some(h[3] as u32*h[65] as u32);
    m.dpi(u16_at(&h,12,true)? as f64,u16_at(&h,14,true)? as f64);
    m.compression=if h[2]==1 {"RLE"}else{"Без сжатия"}.into();
    let mut end=r.size;
    if h[3]==8 && h[65]==1 && h[1]==5 {
        if r.size<897 || r.get(r.size-769,1).await?[0]!=12 {return Err("PCX: отсутствует 256-цветная палитра".into());}
        end-=769;m.details.push("Палитра в конце файла: 256 элементов RGB".into());
    } else if m.depth.unwrap_or(0)<=4 {m.details.push("В заголовке 16 элементов RGB палитры; использование зависит от версии/режима".into());}
    if end<=128 {return Err("PCX: нет данных пикселей".into());}
    let decoded=line*h[65] as u64*height as u64;
    if h[2]==0 {if end-128<decoded {return Err("PCX: обрезанные несжатые данные".into());}}
    else if (end-128).saturating_mul(63)<decoded {return Err("PCX: данных недостаточно даже при максимальном RLE".into());}
    m.details.push(format!("{} бит/плоскость × {} плоскостей; BytesPerLine={line}",h[3],h[65]));
    Ok(m)
}

struct Tag {typ:u16,count:u32,data:Vec<u8>}
fn type_size(t:u16)->Option<usize> {match t {1|2|6|7=>Some(1),3|8=>Some(2),4|9|11|13=>Some(4),5|10|12=>Some(8),_=>None}}
impl Tag {
    fn ints(&self,le:bool)->Res<Vec<u32>> {
        (0..self.count as usize).map(|i|match self.typ {1=>Ok(self.data[i] as u32),3=>Ok(u16_at(&self.data,i*2,le)? as u32),4|13=>u32_at(&self.data,i*4,le),_=>Err("TIFF: неверный тип целочисленного тега".into())}).collect()
    }
    fn rational(&self,le:bool)->Res<f64> {
        if self.typ!=5 || self.count!=1 {return Err("TIFF: ожидался RATIONAL[1]".into());}
        let a=u32_at(&self.data,0,le)?;let b=u32_at(&self.data,4,le)?;
        if b==0 {return Err("TIFF: нулевой знаменатель".into());}Ok(a as f64/b as f64)
    }
}
fn one(tags:&BTreeMap<u16,Tag>,id:u16,le:bool,default:Option<u32>)->Res<u32> {
    if let Some(t)=tags.get(&id) {if t.count!=1 {return Err(format!("TIFF: тег {id} должен иметь count=1"));}t.ints(le)?.first().copied().ok_or("Пустой тег".into())}
    else {default.ok_or(format!("TIFF: отсутствует тег {id}"))}
}
async fn tiff(r:&Reader,base:u64,len:u64,exif:bool)->Res<Meta> {
    let h=r.get(base,8).await?;let le=match &h[..2] {b"II"=>true,b"MM"=>false,_=>return Err("TIFF: неверный порядок байтов".into())};
    if u16_at(&h,2,le)?!=42 {return Err("UNSUPPORTED:Не классический TIFF (в том числе BigTIFF)".into());}
    let check=|offset:u64,n:u64|->Res<()> {if offset.checked_add(n).is_none_or(|e|e>len) {Err("TIFF: смещение выходит за границы контейнера".into())}else{Ok(())}};
    let mut off=u32_at(&h,4,le)? as u64;let mut seen=HashSet::new();let mut pages=0;let mut m=Meta::new("TIFF");
    let wanted=[256,257,258,259,262,273,277,278,279,282,283,284,296,320,322,323,324,325,338,339];
    while off!=0 {
        if pages>=256 {return Err("UNSUPPORTED:TIFF: более 256 IFD".into());}
        if !seen.insert(off) {return Err("TIFF: циклическая цепочка IFD".into());}
        check(off,2)?;let n=u16_at(&r.get(base+off,2).await?,0,le)? as usize;
        if n>4096 {return Err("UNSUPPORTED:TIFF: более 4096 тегов в IFD".into());}
        check(off,2+n as u64*12+4)?;let table=r.get(base+off+2,n*12+4).await?;let mut tags=BTreeMap::new();
        for entry in table[..n*12].chunks_exact(12) {
            let id=u16_at(entry,0,le)?;let typ=u16_at(entry,2,le)?;let count=u32_at(entry,4,le)?;
            if let Some(size)=type_size(typ) {
                let bytes=(count as u64).checked_mul(size as u64).ok_or("TIFF: переполнение count")?;
                let ptr=u32_at(entry,8,le)? as u64;
                if bytes>4 {check(ptr,bytes)?;}
                if wanted.contains(&id) {
                    if bytes>1_048_576 {return Err("UNSUPPORTED:TIFF: тег больше 1 МиБ".into());}
                    let data=if bytes<=4 {entry[8..8+bytes as usize].to_vec()}else{r.get(base+ptr,bytes as usize).await?};
                    if tags.insert(id,Tag{typ,count,data}).is_some() {return Err("TIFF: повторяющийся тег".into());}
                }
            } else if wanted.contains(&id) {return Err(format!("UNSUPPORTED:TIFF: тип {typ} тега {id}"));}
        }
        if pages==0 {
            if !exif {m.dimensions(one(&tags,256,le,None)?,one(&tags,257,le,None)?)?;
                let samples=one(&tags,277,le,Some(1))?;if samples==0 || samples>64 {return Err("TIFF: неверный SamplesPerPixel".into());}
                let bits=if let Some(t)=tags.get(&258) {t.ints(le)?}else{vec![1]};
                if bits.is_empty() || bits.iter().any(|v|*v==0 || *v>64) {return Err("TIFF: неверный BitsPerSample".into());}
                let depth=if bits.len()==1 {bits[0]*samples} else if bits.len()==samples as usize {bits.iter().sum()} else {return Err("TIFF: BitsPerSample не соответствует SamplesPerPixel".into());};
                m.depth=Some(depth);
                let comp=one(&tags,259,le,Some(1))?;
                m.compression=match comp {1=>"Без сжатия",2=>"CCITT RLE",3=>"CCITT Group 3",4=>"CCITT Group 4",5=>"LZW",6=>"JPEG (old-style)",7=>"JPEG",8|32946=>"DEFLATE",32773=>"PackBits",_=>"Другой алгоритм"}.into();
                m.details.push(format!("Compression={comp}; BitsPerSample={bits:?}; SamplesPerPixel={samples}; PhotometricInterpretation={}",one(&tags,262,le,Some(0))?));
                if let Some(p)=tags.get(&320) {if p.count%3!=0 {return Err("TIFF: неверный ColorMap".into());}m.details.push(format!("ColorMap: {} цветов, три массива 16-битных компонент R/G/B",p.count/3));}
            }
            let unit=one(&tags,296,le,Some(2))?;
            let factor=match unit {2=>Some(1.),3=>Some(2.54),_=>None};
            if let Some(f)=factor {
                if let Some(t)=tags.get(&282) {let x=t.rational(le)?*f;if x>0. {m.dpi_x=Some(x);}}
                if let Some(t)=tags.get(&283) {let y=t.rational(le)?*f;if y>0. {m.dpi_y=Some(y);}}
            } else {m.details.push("ResolutionUnit: абсолютный DPI не задан".into());}
        }
        if !exif {
            let mut found=false;
            for (a,b) in [(273,279),(324,325)] {
                if let (Some(o),Some(c))=(tags.get(&a),tags.get(&b)) {
                    let offsets=o.ints(le)?;let sizes=c.ints(le)?;
                    if offsets.is_empty() || offsets.len()!=sizes.len() {return Err("TIFF: массивы смещений и размеров не совпадают".into());}
                    for (o,c) in offsets.iter().zip(&sizes) {if *c==0 {return Err("TIFF: пустая полоса/плитка".into());}check(*o as u64,*c as u64)?;}
                    found=true;
                } else if tags.contains_key(&a) || tags.contains_key(&b) {return Err("TIFF: нет парного тега offset/bytecount".into());}
            }
            if !found {return Err("UNSUPPORTED:TIFF: нет Strip/TileOffsets и ByteCounts (возможен old-style JPEG)".into());}
        }
        pages+=1;if exif {break;}
        off=u32_at(&table,n*12,le)? as u64;
    }
    if pages==0 {return Err("TIFF: отсутствует IFD".into());}
    m.details.push(format!("Порядок байтов: {}; IFD: {pages}; свойства первой страницы",if le {"little-endian"}else{"big-endian"}));Ok(m)
}
async fn jpeg(r:&Reader)->Res<Meta> {
    let mut m=Meta::new("JPEG");let mut p=2u64;let mut frame=false;let mut scan=false;let mut exif_dpi=(None,None);
    for _ in 0..100_000 {
        let mut b=r.get(p,1).await?[0];if b!=255 {return Err("JPEG: ожидался маркер FF".into());}
        let mut fill=0;
        while b==255 {p+=1;b=r.get(p,1).await?[0];fill+=1;if fill>1024 {return Err("JPEG: слишком много FF".into());}}
        p+=1;
        if b==0xd9 {break;}
        if b==0 || b==0xd8 || (0xd0..=0xd7).contains(&b) {return Err("JPEG: неверный маркер в заголовке".into());}
        if b==1 {continue;}
        let n=u16_at(&r.get(p,2).await?,0,false)? as u64;if n<2 {return Err("JPEG: длина сегмента меньше 2".into());}r.bounds(p,n)?;
        if b==0xe0 {
            if n>=16 {let d=r.get(p+2,14).await?;
                if d.starts_with(b"JFIF\0") {let x=u16_at(&d,8,false)? as f64;let y=u16_at(&d,10,false)? as f64;
                    match d[7] {1=>m.dpi(x,y),2=>m.dpi(x*2.54,y*2.54),0=>m.details.push(format!("JFIF: отношение плотностей {x}:{y}, без единицы DPI")),_=>return Err("JPEG: неверная единица JFIF".into())}
                    if 16+3*d[12] as u64*d[13] as u64>n {return Err("JPEG: обрезанный JFIF thumbnail".into());}
                }
            }
        } else if b==0xe1 && n>=8 {
            let d=r.get(p+2,6).await?;
            if d==b"Exif\0\0" {
                match tiff(r,p+8,n-8,true).await {
                    Ok(e)=>{exif_dpi=(e.dpi_x,e.dpi_y);m.details.push("DPI из EXIF IFD0 имеет приоритет над JFIF".into());},
                    Err(e)=>return Err(format!("JPEG EXIF: {e}"))
                }
            }
        } else if [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].contains(&b) {
            if n<8 {return Err("JPEG: короткий SOF".into());}let d=r.get(p+2,6).await?;let components=d[5];
            if components==0 || d[0]==0 || n!=8+3*components as u64 {return Err("JPEG: неверный SOF".into());}
            m.dimensions(u16_at(&d,3,false)? as u32,u16_at(&d,1,false)? as u32)?;
            m.depth=Some(d[0] as u32*components as u32);frame=true;
            m.compression=match b {0xc0=>"JPEG baseline DCT / Huffman",0xc2=>"JPEG progressive DCT / Huffman",0xc3|0xc7=>"JPEG lossless / Huffman",0xcb|0xcf=>"JPEG lossless / arithmetic",0xc9|0xca|0xcd|0xce=>"JPEG DCT / arithmetic",_=>"JPEG extended DCT / Huffman"}.into();
            m.details.push(format!("SOF=FF{b:02X}; {} бит/компонент × {components} компонент (обычно YCbCr, не обязательно RGB)",d[0]));
        } else if b==0xda {
            if !frame {return Err("JPEG: SOS перед SOF".into());}
            if n<6 {return Err("JPEG: короткий SOS".into());}
            let c=r.get(p+2,1).await?[0];if c==0 || n!=6+2*c as u64 {return Err("JPEG: неверный SOS".into());}
            scan=true;break;
        }
        p+=n;
    }
    if !frame || !scan {return Err("JPEG: нет SOF/SOS".into());}
    if exif_dpi.0.is_some() {m.dpi_x=exif_dpi.0;}if exif_dpi.1.is_some() {m.dpi_y=exif_dpi.1;}
    // Only a bounded tail is read; entropy-coded pixels are never decoded.
    let n=r.size.min(65_536) as usize;let tail=r.get(r.size-n as u64,n).await?;
    let eoi=tail.windows(2).rposition(|v|v==[255,217]).ok_or("JPEG: в последних 64 КиБ отсутствует EOI (FF D9)")?;
    let sos_len=u16_at(&r.get(p,2).await?,0,false)? as u64;
    if r.size-n as u64+(eoi as u64)<p+sos_len {return Err("JPEG: EOI находится до данных скана".into());}
    if eoi+2!=n {m.warnings.push("После EOI есть данные; найденный маркер проверен только в хвосте".into());}
    Ok(m)
}

#[wasm_bindgen]
pub async fn inspect(size:f64,read:Function)->String {
    if !size.is_finite() || size<0. || size.fract()!=0. || size>9_007_199_254_740_991. {
        return serde_json::to_string(&Meta{status:"damaged".into(),warnings:vec!["Недопустимый размер файла".into()],..Meta::default()}).unwrap_or_default();
    }
    let r=Reader{size:size as u64,callback:read};
    let result:Res<Meta>=async {
        let h=r.get(0,r.size.min(16) as usize).await?;
        match detect(&h) {"PNG"=>png(&r).await,"BMP"=>bmp(&r).await,"GIF"=>gif(&r).await,"PCX"=>pcx(&r).await,
            "TIFF"=>tiff(&r,0,r.size,false).await,"JPEG"=>jpeg(&r).await,
            "BigTIFF"=>Err("UNSUPPORTED:BigTIFF (64-битные IFD) не реализован".into()),
            _=>Err("UNKNOWN:Сигнатура не соответствует поддерживаемым форматам".into())}
    }.await;
    let m=match result {Ok(m)=>m,Err(e)=> {
        let status=if e.starts_with("UNSUPPORTED:") {"unsupported"}else if e.starts_with("UNKNOWN:") {"unknown"}else{"damaged"};
        Meta{status:status.into(),warnings:vec![e],..Meta::default()}
    }};
    serde_json::to_string(&m).unwrap_or_else(|_|"{\"status\":\"damaged\",\"warnings\":[\"Ошибка сериализации\"]}".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn endian_and_bounds() {assert_eq!(u16_at(&[1,2],0,true).unwrap(),513);assert_eq!(u32_at(&[0,0,1,0],0,false).unwrap(),256);assert!(u32_at(&[1],0,true).is_err());}
    #[test] fn crc_reference() {assert_eq!(crc32(b"123456789"),0xcbf43926);}
    #[test] fn signatures() {assert_eq!(detect(b"\x89PNG\r\n\x1a\n"),"PNG");assert_eq!(detect(b"GIF89a"),"GIF");assert_eq!(detect(b"II\x2a\0"),"TIFF");assert_eq!(detect(b"text.jpg"),"Unknown");}
    #[test] fn rational() {let t=Tag{typ:5,count:1,data:vec![44,1,0,0,1,0,0,0]};assert_eq!(t.rational(true).unwrap(),300.);}
}
