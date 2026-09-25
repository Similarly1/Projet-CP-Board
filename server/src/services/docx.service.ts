import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';

export class DocxService {
  /**
   * Convertit un contenu texte/Markdown en document Word (.docx) professionnel
   */
  async markdownToDocxBuffer(title: string, markdownText: string, metadata?: { dateStr?: string; location?: string }): Promise<Buffer> {
    const lines = markdownText.split(/\r?\n/);
    const children: (Paragraph | Table)[] = [];

    // En-tête officiel du document
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'ACTION MONDIALE POUR DIEU • DELÉMONT',
            bold: true,
            size: 20, // 10pt
            color: '64748B',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 36, // 18pt
            color: '1E3A8A', // Bleu marine officiel
            font: 'Calibri',
          }),
        ],
      })
    );

    // Métadonnées (Date, Lieu) si fournies
    if (metadata?.dateStr || metadata?.location) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: `Séance du ${metadata.dateStr || ''} ${metadata.location ? `• ${metadata.location}` : ''}`,
              italics: true,
              size: 22,
              color: '475569',
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Traitement ligne par ligne du Markdown
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        children.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }

      // Titre 1: # Titre
      if (line.startsWith('# ')) {
        const text = line.replace(/^#\s+/, '');
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [
              new TextRun({
                text,
                bold: true,
                size: 28, // 14pt
                color: '1E3A8A',
                font: 'Calibri',
              }),
            ],
          })
        );
        continue;
      }

      // Titre 2: ## Titre
      if (line.startsWith('## ')) {
        const text = line.replace(/^##\s+/, '');
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text,
                bold: true,
                size: 24, // 12pt
                color: '0369A1',
                font: 'Calibri',
              }),
            ],
          })
        );
        continue;
      }

      // Titre 3: ### Titre
      if (line.startsWith('### ')) {
        const text = line.replace(/^###\s+/, '');
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text,
                bold: true,
                size: 22, // 11pt
                color: '334155',
                font: 'Calibri',
              }),
            ],
          })
        );
        continue;
      }

      // Décision / Résolution / Prière (Bloc citation > )
      if (line.startsWith('>')) {
        const quoteText = line.replace(/^>\s*/, '');
        const isDecision = quoteText.toLowerCase().includes('décision') || quoteText.toLowerCase().includes('decision');
        const isPrayer = quoteText.toLowerCase().includes('prière') || quoteText.toLowerCase().includes('priere');

        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: {
                      type: ShadingType.CLEAR,
                      fill: isDecision ? 'EFF6FF' : isPrayer ? 'FAF5FF' : 'F1F5F9',
                    },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    borders: {
                      left: {
                        style: BorderStyle.SINGLE,
                        size: 24,
                        color: isDecision ? '2563EB' : isPrayer ? '9333EA' : '64748B',
                      },
                      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                    },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: quoteText,
                            bold: isDecision,
                            size: 21,
                            font: 'Calibri',
                            color: '1E293B',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
        continue;
      }

      // Tâche avec case à cocher : - [ ] ou - [x]
      const checkMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (checkMatch) {
        const isDone = checkMatch[1].toLowerCase() === 'x';
        const taskText = checkMatch[2];

        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: isDone ? '☒ ' : '☐ ',
                bold: true,
                size: 22,
                color: isDone ? '16A34A' : 'EA580C',
                font: 'Calibri',
              }),
              new TextRun({
                text: taskText,
                size: 22,
                strike: isDone,
                color: isDone ? '64748B' : '1E293B',
                font: 'Calibri',
              }),
            ],
          })
        );
        continue;
      }

      // Liste à puces : - ... ou * ...
      if (line.match(/^[-*]\s+(.*)$/)) {
        const bulletText = line.replace(/^[-*]\s+/, '');
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: bulletText,
                size: 22,
                font: 'Calibri',
              }),
            ],
          })
        );
        continue;
      }

      // Paragraphe standard
      children.push(
        new Paragraph({
          spacing: { after: 100, line: 276 },
          children: [
            new TextRun({
              text: line,
              size: 22, // 11pt
              font: 'Calibri',
              color: '1E293B',
            }),
          ],
        })
      );
    }

    // Création de l'objet Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 pouce
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'Page ',
                      size: 18,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: ' sur ',
                      size: 18,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                      color: '94A3B8',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

export const docxService = new DocxService();
