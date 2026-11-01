import JSZip from 'jszip';
import type { Mesh } from './mesh';

export type MeshPart = { name: string; mesh: Mesh; filament: number };

const COORDINATE_DECIMALS = 4;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="text/xml"/>
</Types>`;

const RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function coordinate(value: number): string {
  return String(Number(value.toFixed(COORDINATE_DECIMALS)));
}

function meshXml(mesh: Mesh): string {
  const vertices: string[] = [];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const [x, y, z] = mesh.vertices.slice(i, i + 3).map(coordinate);
    vertices.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
  }

  const triangles: string[] = [];
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [v1, v2, v3] = mesh.triangles.slice(i, i + 3);
    triangles.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh>`;
}

/**
 * Parts become one multi-part object. Orca and Bambu Studio read the filament
 * slot for each part from Metadata/model_settings.config.
 */
export async function build3mf(objectName: string, parts: MeshPart[]): Promise<ArrayBuffer> {
  const partIds = parts.map((_, index) => index + 1);
  const objectId = parts.length + 1;
  const name = escapeXml(objectName);

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${parts.map((part, i) => `    <object id="${partIds[i]}" name="${escapeXml(part.name)}" type="model">${meshXml(part.mesh)}</object>`).join('\n')}
    <object id="${objectId}" name="${name}" type="model">
      <components>${partIds.map((id) => `<component objectid="${id}"/>`).join('')}</components>
    </object>
  </resources>
  <build>
    <item objectid="${objectId}"/>
  </build>
</model>`;

  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${objectId}">
    <metadata key="name" value="${name}"/>
    <metadata key="extruder" value="${parts[0].filament}"/>
${parts
  .map(
    (part, i) => `    <part id="${partIds[i]}" subtype="normal_part">
      <metadata key="name" value="${escapeXml(part.name)}"/>
      <metadata key="extruder" value="${part.filament}"/>
    </part>`,
  )
  .join('\n')}
  </object>
</config>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELATIONSHIPS);
  zip.file('3D/3dmodel.model', model);
  zip.file('Metadata/model_settings.config', modelSettings);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}
