function blockHex(blockData: string, start: number, length: number): string {
  const chars = blockData.replace(/\s/g, '');
  return chars.substring(start * 2, start * 2 + length * 2);
}

function blockString(blockData: string, start: number, length: number): string {
  const chars = blockHex(blockData, start, length);
  const bytes = new Uint8Array(chars.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  return new TextDecoder('ascii').decode(bytes).replace(/\x00/g, '');
}

function blockInt(blockData: string, start: number, length: number): number {
  const chars = blockHex(blockData, start, length);
  const bytes = chars.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16));
  // little-endian conversion
  let result = 0;
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i] * Math.pow(256, i);
  }
  return result;
}

function blockFloat(blockData: string, start: number, length: number): number {
  const chars = blockHex(blockData, start, length);
  const bytes = new Uint8Array(chars.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  // little-endian float
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  bytes.forEach((byte, i) => view.setUint8(i, byte));
  return view.getFloat32(0, true); // true for little-endian
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

export async function processTagFile(file: File): Promise<{ tagId: string; tagData: object }> {
  try {
    const fileContent = await readFile(file);
    const lines = fileContent.split('\n');

    const blocks: string[] = [];

    // Find lines starting with "Block" and extract the data
    for (const line of lines) {
      if (line.startsWith('Block')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          blocks.push(parts[1].trim());
        }
      }
    }

    const tag_uid = blockHex(blocks[0], 0, 4);

    const output = {
      // command: 'ams_filament_setting',
      tag_uid: tag_uid + '00000100',
      tray_id_name: blockString(blocks[1], 0, 8),
      tray_info_idx: blockString(blocks[1], 8, 8),
      tray_type: blockString(blocks[2], 0, 16),
      tray_sub_brands: blockString(blocks[4], 0, 16),
      tray_color: blockHex(blocks[5], 0, 4),
      tray_weight: blockInt(blocks[5], 4, 2).toString(),
      tray_diameter: blockFloat(blocks[5], 8, 4).toFixed(2),
      tray_temp: blockInt(blocks[6], 0, 2),
      tray_time: blockInt(blocks[6], 2, 2),
      bed_temp_type: blockInt(blocks[6], 4, 2),
      bed_temp: blockInt(blocks[6], 6, 2),
      nozzle_temp_max: blockInt(blocks[6], 8, 2),
      nozzle_temp_min: blockInt(blocks[6], 10, 2),
      xcam_info: blockHex(blocks[8], 0, 12),
      tray_uuid: blockHex(blocks[9], 0, 16),
    };

    return {
      tagId: tag_uid,
      tagData: output,
    };
  } catch (error) {
    console.error('Error processing tag file:', error);
    throw error;
  }
}
