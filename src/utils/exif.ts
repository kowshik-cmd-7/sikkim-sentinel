/**
 * Zero-dependency JPEG EXIF GPS metadata parser.
 * Extracts latitude and longitude from smartphone and camera photos if available.
 */

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

export async function extractGpsFromImage(file: File): Promise<GpsCoordinates | null> {
  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const dataView = new DataView(buffer);

    // Verify JPEG SOI (Start of Image) marker: 0xFFD8
    if (dataView.getUint16(0, false) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    const length = dataView.byteLength;

    while (offset < length) {
      if (dataView.getUint8(offset) !== 0xff) {
        return null;
      }

      const marker = dataView.getUint8(offset + 1);

      // APP1 marker (0xFFE1) contains EXIF metadata
      if (marker === 0xe1) {
        return parseExifApp1(dataView, offset + 4);
      }

      // Skip past marker segment
      if (offset + 2 >= length) return null;
      const segmentLength = dataView.getUint16(offset + 2, false);
      offset += 2 + segmentLength;
    }

    return null;
  } catch {
    // Non-fatal fallback for corrupted or non-EXIF images
    return null;
  }
}

function parseExifApp1(dataView: DataView, tiffHeaderOffset: number): GpsCoordinates | null {
  // Check for "Exif\0\0" header
  const exifHeader =
    String.fromCharCode(dataView.getUint8(tiffHeaderOffset - 4)) +
    String.fromCharCode(dataView.getUint8(tiffHeaderOffset - 3)) +
    String.fromCharCode(dataView.getUint8(tiffHeaderOffset - 2)) +
    String.fromCharCode(dataView.getUint8(tiffHeaderOffset - 1));

  if (exifHeader !== "Exif") {
    return null;
  }

  // Determine TIFF endianness
  const endianness = dataView.getUint16(tiffHeaderOffset, false);
  const littleEndian = endianness === 0x4949; // "II" = Intel / Little Endian

  // Verify TIFF magic number 42 (0x002A)
  if (dataView.getUint16(tiffHeaderOffset + 2, littleEndian) !== 0x002a) {
    return null;
  }

  const ifd0Offset = dataView.getUint32(tiffHeaderOffset + 4, littleEndian);
  let currentOffset = tiffHeaderOffset + ifd0Offset;

  if (currentOffset + 2 > dataView.byteLength) return null;
  const ifd0Entries = dataView.getUint16(currentOffset, littleEndian);
  currentOffset += 2;

  let gpsInfoOffset: number | null = null;

  for (let i = 0; i < ifd0Entries; i++) {
    if (currentOffset + 12 > dataView.byteLength) break;
    const tag = dataView.getUint16(currentOffset, littleEndian);
    if (tag === 0x8825) {
      // GPSInfo tag
      gpsInfoOffset = dataView.getUint32(currentOffset + 8, littleEndian);
      break;
    }
    currentOffset += 12;
  }

  if (gpsInfoOffset === null) return null;

  const gpsOffset = tiffHeaderOffset + gpsInfoOffset;
  if (gpsOffset + 2 > dataView.byteLength) return null;

  const gpsEntries = dataView.getUint16(gpsOffset, littleEndian);
  let gpsEntryOffset = gpsOffset + 2;

  let latRef: string | null = null;
  let latCoords: number[] | null = null;
  let lngRef: string | null = null;
  let lngCoords: number[] | null = null;

  for (let i = 0; i < gpsEntries; i++) {
    if (gpsEntryOffset + 12 > dataView.byteLength) break;
    const tag = dataView.getUint16(gpsEntryOffset, littleEndian);

    if (tag === 0x0001) {
      // GPSLatitudeRef
      latRef = String.fromCharCode(dataView.getUint8(gpsEntryOffset + 8));
    } else if (tag === 0x0002) {
      // GPSLatitude (3 rationals)
      const valOffset = tiffHeaderOffset + dataView.getUint32(gpsEntryOffset + 8, littleEndian);
      latCoords = readRationals(dataView, valOffset, 3, littleEndian);
    } else if (tag === 0x0003) {
      // GPSLongitudeRef
      lngRef = String.fromCharCode(dataView.getUint8(gpsEntryOffset + 8));
    } else if (tag === 0x0004) {
      // GPSLongitude (3 rationals)
      const valOffset = tiffHeaderOffset + dataView.getUint32(gpsEntryOffset + 8, littleEndian);
      lngCoords = readRationals(dataView, valOffset, 3, littleEndian);
    }

    gpsEntryOffset += 12;
  }

  if (latCoords && lngCoords && latCoords.length === 3 && lngCoords.length === 3) {
    const lat0 = latCoords[0];
    const lat1 = latCoords[1];
    const lat2 = latCoords[2];
    const lng0 = lngCoords[0];
    const lng1 = lngCoords[1];
    const lng2 = lngCoords[2];

    if (
      lat0 !== undefined &&
      lat1 !== undefined &&
      lat2 !== undefined &&
      lng0 !== undefined &&
      lng1 !== undefined &&
      lng2 !== undefined
    ) {
      let lat = lat0 + lat1 / 60 + lat2 / 3600;
      let lng = lng0 + lng1 / 60 + lng2 / 3600;

      if (latRef === "S") lat = -lat;
      if (lngRef === "W") lng = -lng;

      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return {
          latitude: Number(lat.toFixed(5)),
          longitude: Number(lng.toFixed(5)),
        };
      }
    }
  }

  return null;
}

function readRationals(
  dataView: DataView,
  offset: number,
  count: number,
  littleEndian: boolean
): number[] {
  const result: number[] = [];
  let cur = offset;
  for (let i = 0; i < count; i++) {
    if (cur + 8 > dataView.byteLength) break;
    const num = dataView.getUint32(cur, littleEndian);
    const den = dataView.getUint32(cur + 4, littleEndian);
    result.push(den === 0 ? 0 : num / den);
    cur += 8;
  }
  return result;
}
