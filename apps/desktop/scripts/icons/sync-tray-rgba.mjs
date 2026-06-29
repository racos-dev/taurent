#!/usr/bin/env node

import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '../..');
const pngPath = resolve(desktopDir, 'src-tauri/icons/tray-template.png');
const rgbaPath = resolve(desktopDir, 'src-tauri/icons/tray-template.rgba');
const shouldWrite = process.argv.includes('--write');

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  if (aboveDistance <= upperLeftDistance) {
    return above;
  }

  return upperLeft;
}

function decodePngRgba(path) {
  const bytes = readFileSync(path);
  const signature = bytes.subarray(0, 8);
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error(`${path} is not a PNG file`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === 'IDAT') {
      idatChunks.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (width !== 64 || height !== 64 || bitDepth !== 8 || colorType !== 6) {
    throw new Error(`${path} must be a 64x64 8-bit RGBA PNG`);
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;
  let previousRow = Buffer.alloc(rowLength);

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const scanline = inflated.subarray(inputOffset, inputOffset + rowLength);
    inputOffset += rowLength;
    const outputRow = Buffer.alloc(rowLength);

    for (let x = 0; x < rowLength; x += 1) {
      const left = x >= bytesPerPixel ? outputRow[x - bytesPerPixel] : 0;
      const above = previousRow[x];
      const upperLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;
      let predictor = 0;

      if (filterType === 1) {
        predictor = left;
      } else if (filterType === 2) {
        predictor = above;
      } else if (filterType === 3) {
        predictor = Math.floor((left + above) / 2);
      } else if (filterType === 4) {
        predictor = paeth(left, above, upperLeft);
      } else if (filterType !== 0) {
        throw new Error(`Unsupported PNG filter type ${filterType}`);
      }

      outputRow[x] = (scanline[x] + predictor) & 0xff;
    }

    outputRow.copy(rgba, y * rowLength);
    previousRow = outputRow;
  }

  return rgba;
}

const expected = decodePngRgba(pngPath);

if (shouldWrite) {
  writeFileSync(rgbaPath, expected);
  console.info(`Updated ${rgbaPath}`);
  process.exit(0);
}

const actual = readFileSync(rgbaPath);
if (!actual.equals(expected)) {
  console.error(`${rgbaPath} is out of sync with ${pngPath}`);
  console.error('Run: pnpm --filter taurent icons:sync');
  process.exit(1);
}

console.info('Tray RGBA sidecar is in sync.');
