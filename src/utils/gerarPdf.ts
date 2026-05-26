import jsPDF from 'jspdf';
import templateP1 from '../assets/template_p1.jpg';
import templateP2 from '../assets/template_p2.jpg';

export const gerarAtaPDF = async (formData: any, fotoBase64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            // 1. Instanciar o documento A4
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // 2. Adicionar o Fundo da Página 1
            // (imagem, formato, x, y, largura, altura)
            doc.addImage(templateP1, 'JPEG', 0, 0, 210, 297);

            // =========================================================================
            // PÁGINA 1: CALIBRAÇÃO DOS CAMPOS (Ajuste os números abaixo se precisar)
            // doc.text("Texto", X_Horizontal, Y_Vertical)
            // =========================================================================

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);

            // 1. Campo: Unidade / Contrato
            // Se estiver muito para a esquerda, aumente o X (65). Se estiver muito alto, aumente o Y (72).
            doc.text(`${formData.unidade} / ${formData.contrato}`, 65, 72); 

            // 2. Campo: Data
            // Ajuste o X e Y para que fique exatamente ao lado da palavra "Data:" do formulário
            const dataAta = formData.data_emissao || new Date().toLocaleDateString('pt-BR');
            doc.text(dataAta, 45, 82); 

            // 3. Campo: Encarregado/Supervisor
            doc.text(formData.responsavel, 75, 92); 

            // 4. Campo: Tópicos Abordados / Objeto da Visita
            // Se o texto precisar descer para a linha correta, aumente o 135 para 140, 145...
            doc.text(formData.objetoVisita, 25, 135); 

            // 5. Campo: Descrição da ATA / Observações
            // O '170' é a largura máxima do parágrafo antes de quebrar a linha automaticamente
            const obsFormatadas = doc.splitTextToSize(formData.observacoes || "Nenhuma observação.", 170);
            // O '155' é a altura onde o bloco de texto começa a ser escrito
            doc.text(obsFormatadas, 25, 155); 

            // =========================================================================
            // PÁGINA 2: CALIBRAÇÃO DA FOTO E ASSINATURA
            // =========================================================================
            doc.addPage();
            doc.addImage(templateP2, 'JPEG', 0, 0, 210, 297); // Mantido JPEG para bater com o import

            // Inserir a Foto Biométrica do Colaborador
            // Se a foto estiver muito grande ou fora de centro:
            // (imagem, formato, X, Y, Largura, Altura)
            doc.addImage(fotoBase64, 'JPEG', 60, 45, 90, 67.5);

            // Inserir o Nome do Encarregado na linha de assinatura da página 2
            // Ajuste o 160 (X) e 210 (Y) para carimbar o nome exatamente sobre a linha de assinatura
            doc.text(formData.responsavel, 60, 210);

            // 8. Retornar o PDF em Base64 para o n8n
            const pdfBase64 = doc.output('datauristring');
            resolve(pdfBase64);

        } catch (error) {
            console.error("Erro ao gerar PDF: ", error);
            reject(error);
        }
    });
};