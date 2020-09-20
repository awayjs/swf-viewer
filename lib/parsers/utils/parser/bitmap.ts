/**
 * Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assert, ImageType, roundToMultipleOfFour, Inflate} from "@awayjs/graphics";
import {ImageDefinition} from "./image";
//import notImplemented = Shumway.Debug.notImplemented;
//import assertUnreachable = Shumway.Debug.assertUnreachable;
//import roundToMultipleOfFour = Shumway.IntegerUtilities.roundToMultipleOfFour;

import {BitmapTag, SwfTagCode} from "../../../factories/base/SWFTags"

export const enum BitmapFormat {
  /**
   * 8-bit color mapped image.
   */
  FORMAT_COLORMAPPED  = 3,

  /**
   * 15-bit RGB image.
   */
  FORMAT_15BPP        = 4,

  /**
   * 24-bit RGB image, however stored as 4 byte value 0x00RRGGBB.
   */
  FORMAT_24BPP        = 5
}

/** @const */ var FACTOR_5BBP = 255 / 31;

/*
 * Returns a Uint8ClampedArray of RGBA values. The source image is color mapped meaning
 * that the buffer is first prefixed with a color table:
 *
 * +--------------|--------------------------------------------------+
 * | Color Table  |  Image Data (byte indices into the color table)  |
 * +--------------|--------------------------------------------------+
 *
 * Color Table entries are either in RGB or RGBA format.
 *
 * There are two variations of these file formats, with or without alpha.
 *
 * Row pixels always start at 32 bit alinged offsets, the color table as
 * well as the end of each row may be padded so that the next row of pixels
 * is aligned.
 */
function parseColorMapped(tag: BitmapTag): Uint8ClampedArray {
  var width = tag.width, height = tag.height;
  var hasAlpha = tag.hasAlpha;

  var padding = roundToMultipleOfFour(width) - width;
  var colorTableLength = tag.colorTableSize + 1;
  var colorTableEntrySize = hasAlpha ? 4 : 3;  
  var colorTableSize = colorTableLength * colorTableEntrySize;
  var outputDataSize = colorTableSize + ((width + padding) * height);

  var bytes: Uint8Array = Inflate.inflate(tag.bmpData, outputDataSize, true);
  var view = new Uint32Array(width * height);
  var p = colorTableSize, i = 0, offset = 0;

  if (hasAlpha) {
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        offset = bytes[p++] << 2;
        
        view[i++] = (
            bytes[offset + 3] << 24
          | bytes[offset + 2] << 16 
          | bytes[offset + 1] << 8 
          | bytes[offset + 0]) >>> 0;
      }
      p += padding;
    }
  } else {
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        offset = bytes[p++] * colorTableEntrySize;

        view[i++] = (
          0xff << 24
          | bytes[offset + 2] << 1
          | bytes[offset + 1] << 8
          | bytes[offset + 0]) >>> 0;
      }
      p += padding;
    }
  }

  return new Uint8ClampedArray(view.buffer);
}

/**
 * Returns a Uint8ClampedArray of RGBA values.
 */
function parse24BPP(tag: BitmapTag): Uint8ClampedArray {
  const width = tag.width;
  const height = tag.height;
  const hasAlpha = tag.hasAlpha;

  // Even without alpha, 24BPP is stored as 4 bytes, probably for alignment reasons.
  const dataSize = height * width * 4;
  const bytes = Inflate.inflate(tag.bmpData, dataSize, true);

  //bytes are in ARGB format, so we need to convert to RGBA
  const view = new Uint32Array(bytes.buffer);
  let p = 0;

  // in => PMA ARGB, out => NPMA RGBA
  // ?
  // Unpremultiply
  for (let i = 0, l = view.length; i < l; i ++) {

    let c = view[i];
    let a = c & 0xff; // A
    let factor = a ? 0xFF / a : 1;

    let b = ((c >> 24) & 0xff) * factor | 0; // B
    let g = ((c >> 16) & 0xff) * factor | 0; // G
    let r = ((c >> 8 ) & 0xff) * factor | 0; // R

    view[i] = (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }

  //assert (p * 4 === dataSize, "We should be at the end of the data buffer now.");
  return new Uint8ClampedArray(bytes.buffer);
}

function parse15BPP(tag: BitmapTag): Uint8ClampedArray {
  console.log("parse15BPP");
  //notImplemented("parse15BPP");
  /*
   case FORMAT_15BPP:
   var colorType = 0x02;
   var bytesPerLine = ((width * 2) + 3) & ~3;
   var stream = createInflatedStream(bmpData, bytesPerLine * height);

   for (var y = 0, i = 0; y < height; ++y) {
   stream.ensure(bytesPerLine);
   for (var x = 0; x < width; ++x, i += 4) {
   var word = stream.readUi16();
   // Extracting RGB color components and changing values range
   // from 0..31 to 0..255.
   data[i] = 0 | (FACTOR_5BBP * ((word >> 10) & 0x1f));
   data[i + 1] = 0 | (FACTOR_5BBP * ((word >> 5) & 0x1f));
   data[i + 2] = 0 | (FACTOR_5BBP * (word & 0x1f));
   data[i + 3] = 255;
   }
   stream += bytesPerLine;
   }
   break;
   */
  return null;
}

export function defineBitmap(tag: BitmapTag): {definition: ImageDefinition; type: string, id: number} {
 // enterTimeline("defineBitmap");
  var data: Uint8ClampedArray;
  var type = ImageType.None;
  switch (tag.format) {
    case BitmapFormat.FORMAT_COLORMAPPED:
      data = parseColorMapped(tag);
      type = ImageType.PremultipliedAlphaARGB;
      break;
    case BitmapFormat.FORMAT_24BPP:
      data = parse24BPP(tag);
      type = ImageType.PremultipliedAlphaARGB;
      break;
    case BitmapFormat.FORMAT_15BPP:
      data = parse15BPP(tag);
      type = ImageType.PremultipliedAlphaARGB;
      break;
    default:
      console.log('invalid bitmap format');
  }
  //leaveTimeline();
  return {
    definition: {
      type: 'image',
      id: tag.id,
      width: tag.width,
      height: tag.height,
      mimeType: 'application/octet-stream',
      data: data,
      dataType: type,
      image: null
    },
    type: 'image',
    id: tag.id,
  };
}
