import type { Waiver } from '$lib/server/db/schema';
import pdfjs from 'pdfjs';
import Helvetica from 'pdfjs/font/Helvetica.js';
import HelveticaBold from 'pdfjs/font/Helvetica-Bold.js';

const WAIVER_PARAGRAPHS = [
  'For and in consideration of receiving permission to use the Starforge Foundry Inc. ("Starforge") facilities, equipment and tools, I hereby COVENANT NOT TO SUE AND WAIVE ANY AND ALL CLAIMS AGAINST Starforge or its volunteers, officers, agents, directors or employees (collectively, the "RELEASEES"). I further agree to INDEMNIFY, DEFEND AND HOLD HARMLESS the RELEASESS from and against any and all liabilities, costs, claims, demands, and damages of any kind or character arising from or related to any loss, damage, or injury, including death, that may be sustained by me, or any of my personal property, while in, on or about the Starforge facility, using any equipment or tools located therein, or participating in any other activity at the Starforge facility WHETHER CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE RELEASEES OR OTHERWISE.',
  'I am fully aware of the unusual risks involved and hazards connected with any kind of use of the Starforge facility, equipment, and tools, especially the operation of saws, machines, tools and other metal and wood working equipment, and I hereby elect to voluntarily use the same with full knowledge that said activities may be hazardous to me and my property. I VOLUNTARILY ASSUME FULL RESPONSIBILITY FOR ANY RISKS OF LOSS, PROPERTY DAMAGE OR PERSONAL INJURY, INCLUDING DEATH, that may be sustained by me, or any loss or damage of property owned by me, as a result of being engaged in, or around others engaged in, such activities, WHETHER CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF RELEASEES OR OTHERWISE.',
  'I understand that Starforge may not maintain a current insurance policy covering any circumstance arising from my participation in the use of its facilities, equipment, and tools. As such, I am aware that I should review my personal insurance portfolio. It is my express intent that this Waiver of Liability and Hold Harmless Agreement shall bind the members of my family and spouse, if I am alive, and my heirs, assigns and personal representatives, if I am deceased, and shall be deemed as a FULL RELEASE, WAIVER, DISCHARGE AND COVENANT NOT TO SUE THE RELEASEES.',
  'No oral representations, statements, or inducements regarding my use of the Starforge facilities, equipment, and tools have been made. I am at least 18 years of age and fully competent and I execute this Release for full, adequate and complete consideration fully intending to be bound by hereby. IN SIGNING THIS RELEASE, I ACKNOWLEDGE AND REPRESENT THAT I HAVE READ THIS RELEASE IN ITS ENTIRETY AND HAVE SIGNED IT VOLUNTARILY.',
];

export async function generateWaiverPdf(waiver: Waiver): Promise<Buffer> {
  // @ts-expect-error pdfjs types expect Buffer but AFM font JSON objects work at runtime
  const font = new pdfjs.Font(Helvetica);
  // @ts-expect-error pdfjs types expect Buffer but AFM font JSON objects work at runtime
  const boldFont = new pdfjs.Font(HelveticaBold);

  const doc = new pdfjs.Document({
    font,
    fontSize: 10,
    lineHeight: 1.4,
  });

  // Title
  doc.text('WAIVER OF LIABILITY AND HOLD HARMLESS AGREEMENT', {
    font: boldFont,
    fontSize: 14,
    textAlign: 'center',
  });
  doc.text('STARFORGE FOUNDRY INC.', {
    font: boldFont,
    fontSize: 12,
    textAlign: 'center',
  });

  doc.text(' ', { fontSize: 6 });

  // Body paragraphs
  for (const paragraph of WAIVER_PARAGRAPHS) {
    doc.text(paragraph, { fontSize: 9, textAlign: 'justify' });
    doc.text(' ', { fontSize: 6 });
  }

  doc.text(' ', { fontSize: 12 });

  // Signer information
  const signedDate =
    typeof waiver.signedDate === 'string'
      ? waiver.signedDate
      : waiver.signedDate.toLocaleString({ month: 'long', day: 'numeric', year: 'numeric' });

  doc.text(`Name: ${waiver.firstName} ${waiver.lastName}`, { font: boldFont, fontSize: 11 });
  doc.text(`Email: ${waiver.email}`, { fontSize: 11 });
  doc.text(`Date Signed: ${signedDate}`, { fontSize: 11 });

  doc.text(' ', { fontSize: 12 });
  doc.text('Signature:', { font: boldFont, fontSize: 11 });

  // Fetch and embed signature image
  try {
    const response = await fetch(waiver.signatureUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const image = new pdfjs.Image(buffer);
      doc.image(image, { width: 200 });
    }
  } catch {
    doc.text('[Signature image unavailable]', { fontSize: 9, color: 0x999999 });
  }

  return await doc.asBuffer();
}
