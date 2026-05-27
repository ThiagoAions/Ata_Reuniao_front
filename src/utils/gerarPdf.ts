import jsPDF from 'jspdf';
import templateP1 from '../assets/template_p1.jpg';
import templateP2 from '../assets/template_p2.jpg';

// =============================================================================
// 📐 PDF CALIBRATION CONFIG — EDIT ONLY HERE TO ALIGN FIELDS
// =============================================================================
// Coordinate System (jsPDF uses mm from the top-left corner of the page):
//   X: Increase to move RIGHT  | Decrease to move LEFT   (horizontal axis)
//   Y: Increase to move DOWN   | Decrease to move UP     (vertical axis)
//   A4 page = 210mm wide x 297mm tall
// =============================================================================

const PDF_CONFIG = {

  // ── Global text settings ──────────────────────────────────────────────────
  font: {
    family: 'helvetica',
    style: 'normal',
    size: 11,             // Change to 10 for smaller text, 12 for bigger
    color: { r: 0, g: 0, b: 0 }, // RGB black
  },

  // ── Page dimensions (A4) ──────────────────────────────────────────────────
  page: {
    width: 210,
    height: 297,
  },

  // ── PAGE 1 FIELDS (calibrated via DragAndDropCalibrator) ────────────────
  pagina1: {

    // "Unidade / Contrato" — appears right after the "Unidade / Contrato:" label
    unidade_contrato: {
      x: 67.7,
      y: 61.6,
    },

    // "Data" — appears right after "Data: ___/___/___"
    data: {
      x: 39.7,
      y: 71.1,
    },

    // "Encarregado / Supervisor" — after the label on the template
    encarregado: {
      x: 77.5,
      y: 80.9,
    },

    // "Objeto da Visita / Tópicos Abordados"
    objeto_visita: {
      x: 19.6,
      y: 133.3,
    },

    // "Observações / Descrição da ATA" — multi-line text block
    observacoes: {
      x: 20.4,
      y: 184.1,
      maxWidth: 170,  // Max paragraph width before automatic line-break (in mm)
    },
  },

  // ── PAGE 2 FIELDS (calibrated via DragAndDropCalibrator) ────────────────
  pagina2: {

    // Biometric photo placement
    foto_biometria: {
      x: 91.8,
      y: 123.8,
      width: 90,      // Largura da foto (não veio do calibrador — mantido original)
      height: 67.5,   // Altura da foto (não veio do calibrador — mantido original)
    },

    // Encarregado name on the signature line
    assinatura_encarregado: {
      x: 90.7,
      y: 201.8,
    },
  },
};

// =============================================================================
// 📄 PDF GENERATOR FUNCTION
// =============================================================================

export const gerarAtaPDF = async (formData: any, fotoBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const { font, page, pagina1, pagina2 } = PDF_CONFIG;

      // 1. Create A4 document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // =====================================================================
      // PAGE 1
      // =====================================================================

      // Background template
      doc.addImage(templateP1, 'JPEG', 0, 0, page.width, page.height);

      // Font setup
      doc.setFont(font.family, font.style);
      doc.setFontSize(font.size);
      doc.setTextColor(font.color.r, font.color.g, font.color.b);

      // Field: Unidade / Contrato
      doc.text(
        `${formData.unidade} / ${formData.contrato}`,
        pagina1.unidade_contrato.x,
        pagina1.unidade_contrato.y,
      );

      // Field: Data
      const dataAta = formData.data_emissao || new Date().toLocaleDateString('pt-BR');
      doc.text(dataAta, pagina1.data.x, pagina1.data.y);

      // Field: Encarregado / Supervisor
      doc.text(formData.responsavel, pagina1.encarregado.x, pagina1.encarregado.y);

      // Field: Objeto da Visita / Tópicos Abordados
      doc.text(formData.objetoVisita, pagina1.objeto_visita.x, pagina1.objeto_visita.y);

      // Field: Observações (auto line-wrapping)
      const obsFormatadas = doc.splitTextToSize(
        formData.observacoes || 'Nenhuma observação.',
        pagina1.observacoes.maxWidth,
      );
      doc.text(obsFormatadas, pagina1.observacoes.x, pagina1.observacoes.y);

      // =====================================================================
      // PAGE 2
      // =====================================================================

      doc.addPage();
      doc.addImage(templateP2, 'JPEG', 0, 0, page.width, page.height);

      // Biometric photo
      doc.addImage(
        fotoBase64,
        'JPEG',
        pagina2.foto_biometria.x,
        pagina2.foto_biometria.y,
        pagina2.foto_biometria.width,
        pagina2.foto_biometria.height,
      );

      // Signature name
      doc.setFont(font.family, font.style);
      doc.setFontSize(font.size);
      doc.text(
        formData.responsavel,
        pagina2.assinatura_encarregado.x,
        pagina2.assinatura_encarregado.y,
      );

      // Return PDF as Base64 data-URI string
      const pdfBase64 = doc.output('datauristring');
      resolve(pdfBase64);

    } catch (error) {
      console.error('Erro ao gerar PDF: ', error);
      reject(error);
    }
  });
};