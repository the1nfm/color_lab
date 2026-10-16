import { test, expect } from '@playwright/test';
import path from 'node:path';
const fixtures=names=>names.map(n=>path.resolve('tests/fixtures',n));
test('manual parsers: six formats + big-endian TIFF',async({page})=>{
 await page.goto('/');
 await page.getByTestId('files').setInputFiles(fixtures(['rgb.png','rgb.jpg','palette.gif','rgb.bmp','rgb.tif','rgb.pcx','big-endian.tif']));
 await expect(page.getByRole('status')).toContainText('Готово');
 const rows=page.getByTestId('row');await expect(rows).toHaveCount(7);
 for(const ext of ['png','jpg','gif','bmp','tif','pcx']){const row=rows.filter({hasText:`rgb.${ext==='gif'?'gif':ext}`});if(ext!=='gif'){await expect(row).toContainText('Структура OK');await expect(row).toContainText('17 × 11');}}
 await expect(rows.filter({hasText:'palette.gif'})).toContainText('Структура OK');
 await expect(rows.filter({hasText:'big-endian.tif'})).toContainText('2 × 2');
 await expect(rows.filter({hasText:'rgb.jpg'})).toContainText('300.00 × 300.00');
 await expect(rows.filter({hasText:'rgb.tif'})).toContainText('300.00 × 300.00');
});
test('truncation, fake extension and out-of-range offsets',async({page})=>{
 await page.goto('/');await page.getByTestId('files').setInputFiles(fixtures(['no-iend.png','no-eoi.jpg','text.jpg','bad-size.bmp','bad-offset.tif']));
 await expect(page.getByRole('status')).toContainText('Готово');
 await expect(page.getByTestId('row')).toHaveCount(5);
 for(const row of await page.getByTestId('row').all())await expect(row).toContainText('Файл повреждён');
});
test('signature wins over file extension; search and CSV',async({page})=>{
 await page.goto('/');await page.getByTestId('files').setInputFiles(fixtures(['png-renamed.jpg','rgb.bmp']));
 await expect(page.getByRole('status')).toContainText('Готово');
 const row=page.getByTestId('row').filter({hasText:'png-renamed.jpg'});await expect(row).toContainText('PNG');await row.click();await expect(page.locator('.details')).toContainText('Расширение .jpg, но сигнатура PNG');
 await page.getByRole('textbox',{name:'Поиск'}).fill('renamed');await expect(page.getByTestId('row')).toHaveCount(1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт CSV'}).click();expect((await download).suggestedFilename()).toBe('image-metadata.csv');
});
