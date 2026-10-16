import { test, expect } from '@playwright/test';
import path from 'node:path';
test('RGBA, progressive JPEG, compressed/multipage TIFF and EXIF override',async({page})=>{
 await page.goto('/');await page.getByTestId('files').setInputFiles(['rgba.png','progressive.jpg','deflate.tif','multipage.tif','exif.jpg'].map(n=>path.resolve('tests/fixtures',n)));
 await expect(page.getByRole('status')).toContainText('Готово');
 for(const row of await page.getByTestId('row').all())await expect(row).toContainText('Структура OK');
 const rows=page.getByTestId('row');await expect(rows.filter({hasText:'rgba.png'})).toContainText('32');
 await expect(rows.filter({hasText:'progressive.jpg'})).toContainText('progressive');
 await expect(rows.filter({hasText:'deflate.tif'})).toContainText('DEFLATE');
 await expect(rows.filter({hasText:'exif.jpg'})).toContainText('240.00 × 240.00');
 await rows.filter({hasText:'multipage.tif'}).click();await expect(page.locator('.details')).toContainText('IFD: 2');
});
