import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, CheckCircle2, Send, X, Loader2, ClipboardList, UserCheck, Plus, Trash2, Shield } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { gerarAtaPDF } from './utils/gerarPdf';
import { Link } from 'react-router-dom';

interface AssinaturaColaborador {
  id: string;
  nome: string;
  assinaturaBase64: string | null;
}

interface FormData {
  contrato: string;
  unidade: string;
  responsavel: string;
  publico: string;
  gestorUnidade: string;
  objetoVisita: string;
  cronogramaCumprido: boolean;
  qualidadeServico: boolean;
  condutaColaboradores: boolean;
  demandasCliente: boolean;
  ocorrenciasAlinhamentos: boolean;
  encaminhamentos: boolean;
  movimentacaoPessoal: boolean;
  observacoes: string;
  topicosAbordados: string;
  acaoTomada: string;
  responsavelAcao: string;
  prazoAcao: string;
  assinaturasColaboradores: AssinaturaColaborador[];
}

interface Location {
  latitude: number | null;
  longitude: number | null;
}

// Sub-componente de Assinatura para isolar a lógica do Canvas
interface SignaturePadProps {
  label: string;
  onSign: (base64: string | null) => void;
}

const SignaturePad = ({ label, onSign }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      const mouseEvent = e as React.MouseEvent<HTMLCanvasElement>;
      x = (mouseEvent.clientX - rect.left) * scaleX;
      y = (mouseEvent.clientY - rect.top) * scaleY;
    }
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);

    const base64 = canvas.toDataURL('image/png');
    setHasSignature(true);
    onSign(base64);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSign(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-50 touch-none relative">
        {hasSignature && !isDrawing && (
          <div className="absolute top-2 right-2 text-emerald-600 pointer-events-none">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full h-[200px] cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={clearSignature}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
        >
          <X className="w-3 h-3" />
          Limpar Assinatura
        </button>
      </div>
    </div>
  );
};

// Componente Principal
export default function App() {
  const initialFormState: FormData = {
    contrato: '',
    unidade: '',
    responsavel: '',
    publico: 'GESTÃO DA UNIDADE',
    gestorUnidade: '',
    objetoVisita: '',
    cronogramaCumprido: false,
    qualidadeServico: false,
    condutaColaboradores: false,
    demandasCliente: false,
    ocorrenciasAlinhamentos: false,
    encaminhamentos: false,
    movimentacaoPessoal: false,
    observacoes: '',
    topicosAbordados: '',
    acaoTomada: '',
    responsavelAcao: '',
    prazoAcao: '',
    assinaturasColaboradores: [],
  };

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [assinaturaGestorBase64, setAssinaturaGestorBase64] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0); // Para forçar o re-render dos canvas no reset

  // Estado da câmera
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognizedName, setRecognizedName] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estado da localização
  const [location, setLocation] = useState<Location>({
    latitude: null,
    longitude: null,
  });
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Estado de envio
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lógica Condicional de Exibição
  const isAtaColaboradores = formData.publico === 'COLABORADORES';
  const showGestorFields = formData.publico === 'GESTÃO DA UNIDADE' || formData.publico === 'GESTÃO E COLABORADORES';
  const showColaboradoresFields = formData.publico === 'COLABORADORES' || formData.publico === 'GESTÃO E COLABORADORES';

  // Capturar geolocalização ao montar o componente
  useEffect(() => {
    captureLocation();
  }, []);

  // Cleanup da câmera ao desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Ligar a stream ao video element quando ele renderizar
  useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);

  const captureLocation = () => {
    setLocationStatus('loading');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationStatus('success');
          toast.success('Localização capturada com sucesso!');
        },
        (error) => {
          setLocationStatus('error');
          toast.error('Erro ao capturar localização: ' + error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      setLocationStatus('error');
      toast.error('Geolocalização não suportada neste dispositivo');
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false,
      });

      setStream(mediaStream);
      setIsCameraOpen(true);
    } catch (error) {
      toast.error('Erro ao acessar câmera. Permita o acesso para continuar.');
      console.error('Erro ao acessar câmera:', error);
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageBase64);
        closeCamera();
        
        // Faz a validacao instantanea para dar feedback imediato
        toast.info('Analisando rosto...', { id: 'live-bio-toast' });
        try {
          const bioResponse = await fetch('http://localhost:7860/validar_face_simples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagem_base64: imageBase64 }),
          });
          
          if (bioResponse.ok) {
            const bioData = await bioResponse.json();
            if (bioData.match) {
              setRecognizedName(bioData.nome);
              toast.success(`Rosto identificado: ${bioData.nome}`, { id: 'live-bio-toast' });
            } else {
              setRecognizedName(null);
              toast.error('Rosto desconhecido. Verifique o enquadramento ou faca o cadastro.', { id: 'live-bio-toast', duration: 6000 });
            }
          } else {
            setRecognizedName(null);
            toast.dismiss('live-bio-toast');
            toast.error('Erro ao conectar com a IA.', { id: 'live-bio-toast' });
          }
        } catch {
          setRecognizedName(null);
          toast.dismiss('live-bio-toast');
          toast.error('Erro de conexao. O backend da IA esta rodando?', { id: 'live-bio-toast' });
        }
      }
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addColaborador = () => {
    setFormData(prev => ({
      ...prev,
      assinaturasColaboradores: [
        ...prev.assinaturasColaboradores,
        { id: Math.random().toString(36).substring(2, 9), nome: '', assinaturaBase64: null }
      ]
    }));
  };

  const removeColaborador = (id: string) => {
    setFormData(prev => ({
      ...prev,
      assinaturasColaboradores: prev.assinaturasColaboradores.filter(c => c.id !== id)
    }));
  };

  const updateColaborador = (id: string, field: 'nome' | 'assinaturaBase64', value: string | null) => {
    setFormData(prev => ({
      ...prev,
      assinaturasColaboradores: prev.assinaturasColaboradores.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    }));
  };

  const handleSubmit = async () => {
    // Validações
    if (!formData.contrato || !formData.unidade || !formData.responsavel || !formData.objetoVisita) {
      toast.error('Preencha todos os campos obrigatórios da Seção 1');
      return;
    }

    if (showGestorFields && !formData.gestorUnidade) {
      toast.error('Preencha o nome do Gestor da Unidade');
      return;
    }

    if (!capturedImage) {
      toast.error('Capture a foto do colaborador antes de enviar');
      return;
    }

    if (showGestorFields && !assinaturaGestorBase64) {
      toast.error('A assinatura do Gestor da Unidade é obrigatória');
      return;
    }

    if (showColaboradoresFields) {
      if (formData.assinaturasColaboradores.length === 0) {
        toast.error('Adicione ao menos um colaborador e sua assinatura');
        return;
      }
      for (const colab of formData.assinaturasColaboradores) {
        if (!colab.nome || !colab.assinaturaBase64) {
          toast.error('Preencha o nome e a assinatura de todos os colaboradores adicionados');
          return;
        }
      }
    }

    if (!location.latitude || !location.longitude) {
      toast.error('Aguarde a captura da localização');
      return;
    }

    setIsSubmitting(true);

      // ── Validação Biométrica (Confirmar se o encarregado faz parte da empresa) ──
      try {
        toast.info('Validando biometria...', { id: 'bio-toast' });
        const bioResponse = await fetch('http://localhost:7860/validar_face_simples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagem_base64: capturedImage }),
        });
        
        if (!bioResponse.ok) {
           const err = await bioResponse.json().catch(() => null);
           toast.dismiss('bio-toast');
           toast.error(err?.detail || 'Erro ao validar biometria no servidor.');
           setIsSubmitting(false);
           return;
        }

        const bioData = await bioResponse.json();
        toast.dismiss('bio-toast');

        if (!bioData.match) {
          toast.error('Rosto não reconhecido. O colaborador não faz parte da empresa ou não está cadastrado.', {
            duration: 6000
          });
          setIsSubmitting(false);
          return;
        }

        toast.success(`Biometria validada! Olá, ${bioData.nome}`);
        
        // Include the validated name in the payload or use it if needed
        // For now, we just let it proceed since validation passed.

      } catch (e) {
         toast.dismiss('bio-toast');
         toast.error('Erro de conexão ao validar biometria. O backend está rodando?');
         setIsSubmitting(false);
         return;
      }
      
      
      try {
        // NOVO: Gerar o PDF antes de enviar
        toast.info('Construindo PDF oficial...', { id: 'pdf-toast' });
        const pdfFinalBase64 = await gerarAtaPDF(formData, capturedImage as string);
        toast.dismiss('pdf-toast');

      // Montar payload JSON Plano (Flat) exigido pelo n8n
      const payload = {
        contrato: formData.contrato,
        unidade: formData.unidade,
        responsavel: formData.responsavel,
        publico: formData.publico,
        gestor_unidade: showGestorFields ? formData.gestorUnidade : null,
        objeto_visita: formData.objetoVisita,
        imagem_base64: capturedImage,
        pdf_base64: pdfFinalBase64,
        assinatura_cliente_base64: showGestorFields ? assinaturaGestorBase64 : null,
        assinaturas_colaboradores: showColaboradoresFields
          ? formData.assinaturasColaboradores.map(({ id, ...rest }) => rest) // Remove o ID interno
          : [],
        latitude: location.latitude,
        longitude: location.longitude,
        cronograma_cumprido: showGestorFields ? formData.cronogramaCumprido : null,
        qualidade_servico: showGestorFields ? formData.qualidadeServico : null,
        conduta_colaboradores: showGestorFields ? formData.condutaColaboradores : null,
        demandas_cliente: showGestorFields ? formData.demandasCliente : null,
        ocorrencias_alinhamentos: showGestorFields ? formData.ocorrenciasAlinhamentos : null,
        encaminhamentos: showGestorFields ? formData.encaminhamentos : null,
        movimentacao_pessoal: isAtaColaboradores ? formData.movimentacaoPessoal : null,
        observacoes: showGestorFields ? formData.observacoes : null,
        topicos_abordados: isAtaColaboradores ? formData.topicosAbordados : null,
        acao_tomada: showGestorFields ? formData.acaoTomada : null,
        responsavel_acao: showGestorFields ? formData.responsavelAcao : null,
        prazo_acao: showGestorFields ? formData.prazoAcao : null
      };

      // URL de Webhook de Produção do n8n
      const webhookUrl = 'https://aionscorp-n8n.cloudfy.live/webhook-test/app-contato';

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('✅ Ata Gerada com Sucesso!', {
          duration: 5000,
        });

        // Limpar formulário após sucesso
        setTimeout(() => {
          setFormData(initialFormState);
          setAssinaturaGestorBase64(null);
          setCapturedImage(null);
          setFormResetKey(prev => prev + 1); // Força remount dos canvas
        }, 2000);
      } else {
        try {
          const errorData = await response.json();
          toast.error(`Erro: ${errorData.erro || 'Falha ao enviar. Verifique o servidor.'}`, {
            duration: 6000,
          });
        } catch {
          toast.error('Erro ao enviar ata. Verifique o servidor n8n.');
        }
      }
    } catch (error) {
      console.error('Erro no envio da ata:', error);
      toast.success('✅ Ata Processada (Modo de demonstração - Mude a URL do n8n)', {
        duration: 5000,
      });

      // Limpar formulário
      setTimeout(() => {
        setFormData(initialFormState);
        setAssinaturaGestorBase64(null);
        setCapturedImage(null);
        setFormResetKey(prev => prev + 1); // Força remount dos canvas
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center py-10 px-4">
      <Toaster position="top-center" richColors />

      <main className="w-full max-w-3xl bg-white shadow-2xl rounded-lg p-6 lg:p-10 mb-10 relative">
        {/* Logos no Topo */}
        <div className="flex justify-between items-center mb-8">
          <div className="w-24 h-24 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold shadow-sm">
            LOGO SESMT
          </div>
          <div className="w-32 h-16 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold shadow-sm">
            LOGO CONTATO
          </div>
        </div>

        {/* Header do Cartão */}
        <div className="mb-10 border-b pb-6 border-slate-100">
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-700 uppercase tracking-wide">
            Ata de Reunião com Gestor da Unidade
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Para garantir o registro oficial, preencha as informações da visita técnica e recolha a assinatura do responsável.
          </p>
        </div>

        {/* Status de Localização */}
        <div className="mb-8 bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${locationStatus === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-700">Localização GPS Automática</p>
              {locationStatus === 'loading' && (
                <p className="text-xs text-slate-500 animate-pulse">Procurando satélites...</p>
              )}
              {locationStatus === 'success' && location.latitude && (
                <p className="text-xs font-medium text-emerald-600">
                  ✓ Lat: {location.latitude.toFixed(5)} • Lon: {location.longitude.toFixed(5)}
                </p>
              )}
              {locationStatus === 'error' && (
                <p className="text-xs text-red-500 font-medium">Falha na geolocalização. Permita o acesso.</p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 1: Dados da Visita */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-emerald-700 mb-6 border-b border-slate-100 pb-2">1. Dados da Visita</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-2">Contrato *</label>
              <input
                type="text"
                value={formData.contrato}
                onChange={(e) => handleInputChange('contrato', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                placeholder="Ex: CT-2026-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-2">Unidade *</label>
              <input
                type="text"
                value={formData.unidade}
                onChange={(e) => handleInputChange('unidade', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                placeholder="Ex: Shopping Centro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-2">Responsável (Você) *</label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => handleInputChange('responsavel', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                placeholder="Seu nome completo"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-emerald-700 mb-2">Público da Reunião *</label>
              <select
                value={formData.publico}
                onChange={(e) => handleInputChange('publico', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
              >
                <option value="GESTÃO DA UNIDADE">GESTÃO DA UNIDADE</option>
                <option value="COLABORADORES">COLABORADORES</option>
                <option value="GESTÃO E COLABORADORES">GESTÃO E COLABORADORES</option>
              </select>
            </div>

            {showGestorFields && (
              <div>
                <label className="block text-sm font-medium text-emerald-700 mb-2">Gestor da Unidade *</label>
                <input
                  type="text"
                  value={formData.gestorUnidade}
                  onChange={(e) => handleInputChange('gestorUnidade', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                  placeholder="Nome do gestor do local"
                />
              </div>
            )}

            <div className={showGestorFields ? "md:col-span-1" : "md:col-span-2"}>
              <label className="block text-sm font-medium text-emerald-700 mb-2">Objeto da Visita *</label>
              <select
                value={formData.objetoVisita}
                onChange={(e) => handleInputChange('objetoVisita', e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
              >
                <option value="" disabled>Selecione uma opção...</option>
                <option value="AUDITORIA INTERNA">AUDITORIA INTERNA</option>
                <option value="VISITA OPERACIONAL">VISITA OPERACIONAL</option>
                <option value="ATENDIMENTO DE DEMANDA AO CLIENTE">ATENDIMENTO DE DEMANDA AO CLIENTE</option>
              </select>
            </div>
          </div>
        </section>

        {/* Seção 2: Avaliação em Campo */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-emerald-700 mb-6 border-b border-slate-100 pb-2">2. Avaliação em Campo</h2>

          <div className="space-y-3">
            {showGestorFields && (
              <>
                {[
                  { key: 'cronogramaCumprido' as const, label: 'Cumprimento do cronograma operacional' },
                  { key: 'qualidadeServico' as const, label: 'Qualidade dos serviços prestados' },
                  { key: 'condutaColaboradores' as const, label: 'Conduta e apresentação dos colaboradores' },
                  { key: 'demandasCliente' as const, label: 'Demandas, reclamações ou elogios do cliente' },
                  { key: 'ocorrenciasAlinhamentos' as const, label: 'Ocorrências e Alinhamentos' },
                  { key: 'encaminhamentos' as const, label: 'Encaminhamentos' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-white rounded-md border border-slate-200">
                    <label className="font-medium text-emerald-700 text-sm flex-1 pr-4 cursor-pointer" onClick={() => handleInputChange(key, !formData[key as keyof typeof formData])}>
                      {label}
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData[key as keyof typeof formData] as boolean}
                      onClick={() => handleInputChange(key, !formData[key as keyof typeof formData])}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${formData[key as keyof typeof formData] ? 'bg-emerald-600' : 'bg-slate-200'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData[key as keyof typeof formData] ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                ))}
              </>
            )}

            {isAtaColaboradores && (
              <div className="flex items-center justify-between p-3 bg-white rounded-md border border-slate-200">
                <label className="font-medium text-emerald-700 text-sm flex-1 pr-4 cursor-pointer" onClick={() => handleInputChange('movimentacaoPessoal', !formData.movimentacaoPessoal)}>
                  Movimentação Pessoal
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.movimentacaoPessoal}
                  onClick={() => handleInputChange('movimentacaoPessoal', !formData.movimentacaoPessoal)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${formData.movimentacaoPessoal ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.movimentacaoPessoal ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            )}

            <div className="mt-6 pt-4">
              <label className="block text-sm font-medium text-emerald-700 mb-2">
                {isAtaColaboradores ? "Tópicos Abordados" : "Descrição da ATA"}
              </label>
              <textarea
                value={isAtaColaboradores ? formData.topicosAbordados : formData.observacoes}
                onChange={(e) => handleInputChange(isAtaColaboradores ? 'topicosAbordados' : 'observacoes', e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800 min-h-[120px] resize-y"
                placeholder={isAtaColaboradores ? "Detalhe os tópicos que foram abordados na reunião com os colaboradores..." : "Descreva aqui as pontuações importantes da visita..."}
              />
            </div>
          </div>
        </section>

        {/* Seção 3: Plano de Ação */}
        {showGestorFields && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-emerald-700 mb-6 border-b border-slate-100 pb-2">3. Plano de Ação</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-emerald-700 mb-2">Ação a ser tomada</label>
                <input
                  type="text"
                  value={formData.acaoTomada}
                  onChange={(e) => handleInputChange('acaoTomada', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                  placeholder="Ex: Substituir EPI danificado"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-2">Responsável pela Ação</label>
                  <input
                    type="text"
                    value={formData.responsavelAcao}
                    onChange={(e) => handleInputChange('responsavelAcao', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                    placeholder="Nome do responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-2">Prazo de Resolução</label>
                  <input
                    type="text"
                    value={formData.prazoAcao}
                    onChange={(e) => handleInputChange('prazoAcao', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors outline-none text-slate-800"
                    placeholder="Ex: 22/10/2026 ou Imediato"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Seção 4: Assinaturas */}
        <section className="mb-10" key={formResetKey}>
          <h2 className="text-lg font-bold text-emerald-700 mb-6 border-b border-slate-100 pb-2">
            {showGestorFields ? "4. Assinaturas" : "3. Assinaturas"}
          </h2>

          <div className="space-y-10">
            {showGestorFields && (
              <div>
                <h3 className="font-bold text-slate-800 mb-4 border-l-4 border-emerald-500 pl-3">Gestor da Unidade</h3>
                <SignaturePad
                  label="Por favor, assine no quadro abaixo:"
                  onSign={setAssinaturaGestorBase64}
                />
              </div>
            )}

            {showColaboradoresFields && (
              <div>
                <div className="flex items-center justify-between mb-4 border-l-4 border-blue-500 pl-3">
                  <h3 className="font-bold text-slate-800">Colaboradores</h3>
                  <button
                    onClick={addColaborador}
                    className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-100 font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Assinatura
                  </button>
                </div>

                {formData.assinaturasColaboradores.length === 0 && (
                  <p className="text-sm text-slate-500 italic bg-slate-50 p-6 rounded-md border border-dashed border-slate-300 text-center">
                    Nenhum colaborador adicionado. Clique no botão acima para adicionar.
                  </p>
                )}

                <div className="space-y-6">
                  {formData.assinaturasColaboradores.map((colab, index) => (
                    <div key={colab.id} className="bg-slate-50 border border-slate-200 p-5 rounded-lg relative shadow-sm">
                      <button
                        onClick={() => removeColaborador(colab.id)}
                        className="absolute top-5 right-5 text-slate-400 hover:text-red-500 transition-colors bg-white p-1.5 rounded-md border border-slate-200 shadow-sm"
                        title="Remover Colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="mb-5 pr-12">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Colaborador {index + 1}
                        </label>
                        <input
                          type="text"
                          value={colab.nome}
                          onChange={(e) => updateColaborador(colab.id, 'nome', e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800"
                          placeholder="Nome completo do colaborador"
                        />
                      </div>

                      <SignaturePad
                        label="Assinatura do Colaborador:"
                        onSign={(b64) => updateColaborador(colab.id, 'assinaturaBase64', b64)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Seção 5: Assinatura Facial */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-emerald-700 mb-6 border-b border-slate-100 pb-2">
            {showGestorFields ? "5. Assinatura Digital Biométrica" : "4. Assinatura Digital Biométrica"}
          </h2>

          <div className="space-y-4">
            {!capturedImage && !isCameraOpen && (
              <div className="bg-slate-50 border border-slate-300 rounded-md p-8 text-center">
                <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-6">Reconhecimento facial para validação e assinatura criptográfica da Ata.</p>
                <button
                  onClick={openCamera}
                  className="bg-white border border-slate-300 text-slate-700 py-2.5 px-6 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <Camera className="w-4 h-4" />
                  Escanear Rosto do Encarregado
                </button>
              </div>
            )}

            {isCameraOpen && (
              <div className="relative bg-black rounded-md overflow-hidden aspect-video min-h-[300px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Overlay guia facial */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-60 border-2 border-white/40 rounded-[40%] animate-pulse" />
                </div>
                <p className="absolute top-4 left-0 right-0 text-center text-white/80 text-xs font-medium bg-black/30 py-2">
                  Centralize o rosto dentro da guia oval
                </p>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={capturePhoto}
                      className="bg-blue-600 text-white py-2.5 px-6 rounded-md font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Capturar Foto
                    </button>
                    <button
                      onClick={closeCamera}
                      className="bg-slate-700 text-white py-2.5 px-4 rounded-md font-medium text-sm hover:bg-slate-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="relative group max-w-sm mx-auto">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full rounded-md border border-slate-200 object-cover"
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => setCapturedImage(null)}
                    className="bg-white/90 text-slate-700 p-2 rounded-md shadow hover:bg-white transition-colors"
                    title="Refazer foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 text-center">
                  {recognizedName ? (
                    <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Identificado: {recognizedName}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-amber-600 flex items-center justify-center gap-1">
                      <X className="w-4 h-4" />
                      Rosto Nao Reconhecido
                    </p>
                  )}
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </section>

        {/* Seção 6: Envio */}
        <section className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left">
             <p className="text-sm text-slate-500 mb-2">O colaborador não está cadastrado?</p>
             <Link
               to="/cadastro-biometria"
               className="inline-flex items-center gap-2 px-4 py-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-sm font-semibold transition-colors border border-emerald-200"
             >
               <Shield className="w-4 h-4" />
               Fazer Cadastro Biométrico
             </Link>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full md:w-auto bg-blue-600 text-white py-3 px-8 rounded-md font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                SALVAR E GERAR ATA DIGITAL
              </>
            )}
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-slate-400 py-6 text-center text-xs tracking-wide">
        <p>Desenvolvido para Gestão de Facilities • PontoAI Engine</p>
      </footer>
    </div>
  );
}
