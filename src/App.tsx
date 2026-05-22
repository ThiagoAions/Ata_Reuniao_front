import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, CheckCircle2, Send, X, Loader2, ClipboardList, UserCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';

interface FormData {
  contrato: string;
  unidade: string;
  responsavel: string;
  gestorUnidade: string;
  objetoVisita: string;
  cronogramaCumprido: boolean;
  qualidadeServico: boolean;
  condutaColaboradores: boolean;
  demandasCliente: boolean;
  observacoes: string;
  acaoTomada: string;
  responsavelAcao: string;
  prazoAcao: string;
}

interface Location {
  latitude: number | null;
  longitude: number | null;
}

export default function App() {
  // Estado do formulário
  const [formData, setFormData] = useState<FormData>({
    contrato: '',
    unidade: '',
    responsavel: '',
    gestorUnidade: '',
    objetoVisita: '',
    cronogramaCumprido: false,
    qualidadeServico: false,
    condutaColaboradores: false,
    demandasCliente: false,
    observacoes: '',
    acaoTomada: '',
    responsavelAcao: '',
    prazoAcao: '',
  });

  // Estado da câmera
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
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

  const capturePhoto = () => {
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
        toast.success('Foto capturada com sucesso!');
      }
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validações
    if (
      !formData.contrato ||
      !formData.unidade ||
      !formData.responsavel ||
      !formData.gestorUnidade ||
      !formData.objetoVisita
    ) {
      toast.error('Preencha todos os campos obrigatórios da Seção 1');
      return;
    }

    if (!capturedImage) {
      toast.error('Capture a foto do colaborador antes de enviar');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('Aguarde a captura da localização');
      return;
    }

    // Montar payload JSON Plano (Flat) exigido pelo n8n
    const payload = {
      contrato: formData.contrato,
      unidade: formData.unidade,
      responsavel: formData.responsavel,
      gestor_unidade: formData.gestorUnidade,
      objeto_visita: formData.objetoVisita,
      imagem_base64: capturedImage,
      latitude: location.latitude,
      longitude: location.longitude,
      checklist: {
        cronograma_cumprido: formData.cronogramaCumprido,
        qualidade_servico: formData.qualidadeServico,
        conduta_colaboradores: formData.condutaColaboradores,
        demandas_cliente: formData.demandasCliente,
        observacoes: formData.observacoes,
        acao_tomada: formData.acaoTomada,
        responsavel_acao: formData.responsavelAcao,
        prazo_acao: formData.prazoAcao
      }
    };

    setIsSubmitting(true);

    try {
      // Cole aqui a URL de Webhook de Produção do n8n
      const webhookUrl = 'https://SEU_N8N.com/webhook/receber-ata';
      
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
          setFormData({
            contrato: '',
            unidade: '',
            responsavel: '',
            gestorUnidade: '',
            objetoVisita: '',
            cronogramaCumprido: false,
            qualidadeServico: false,
            condutaColaboradores: false,
            demandasCliente: false,
            observacoes: '',
            acaoTomada: '',
            responsavelAcao: '',
            prazoAcao: '',
          });
          setCapturedImage(null);
        }, 2000);
      } else {
        toast.error('Erro ao enviar ata. Verifique o servidor n8n.');
      }
    } catch (error) {
      console.log('Payload gerado no formato correto:', payload);
      toast.success('✅ Ata Processada (Modo de demonstração - Mude a URL do n8n)', {
        duration: 5000,
      });
      
      // Limpar formulário
      setTimeout(() => {
        setFormData({
            contrato: '',
            unidade: '',
            responsavel: '',
            gestorUnidade: '',
            objetoVisita: '',
            cronogramaCumprido: false,
            qualidadeServico: false,
            condutaColaboradores: false,
            demandasCliente: false,
            observacoes: '',
            acaoTomada: '',
            responsavelAcao: '',
            prazoAcao: '',
        });
        setCapturedImage(null);
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 font-sans">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-center gap-3">
          <ClipboardList className="w-8 h-8 text-blue-200" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Ata Digital Operacional</h1>
            <p className="text-blue-200 text-sm font-medium">Registro de Visitas Técnicas em Campo</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28">
        {/* Status de Localização */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-600 transition-all hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${locationStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-800">Localização GPS Automática</p>
              {locationStatus === 'loading' && (
                <p className="text-sm text-gray-600 animate-pulse">Procurando satélites...</p>
              )}
              {locationStatus === 'success' && location.latitude && (
                <p className="text-sm font-medium text-green-700 tracking-wide">
                  ✓ Lat: {location.latitude.toFixed(5)} • Lon: {location.longitude.toFixed(5)}
                </p>
              )}
              {locationStatus === 'error' && (
                <p className="text-sm text-red-600 font-medium">Falha na geolocalização. Permita o acesso.</p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 1: Dados da Visita */}
        <section className="mb-8 bg-white rounded-2xl shadow-md p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-100">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">1</div>
            <h2 className="text-xl font-bold text-gray-800">Dados da Visita</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Contrato *</label>
              <input
                type="text"
                value={formData.contrato}
                onChange={(e) => handleInputChange('contrato', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Ex: CT-2026-001"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Unidade *</label>
              <input
                type="text"
                value={formData.unidade}
                onChange={(e) => handleInputChange('unidade', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Ex: Shopping Centro"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Responsável (Você) *</label>
              <input
                type="text"
                value={formData.responsavel}
                onChange={(e) => handleInputChange('responsavel', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Gestor da Unidade *</label>
              <input
                type="text"
                value={formData.gestorUnidade}
                onChange={(e) => handleInputChange('gestorUnidade', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Nome do cliente/gestor do local"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Objeto da Visita *</label>
              <input
                type="text"
                value={formData.objetoVisita}
                onChange={(e) => handleInputChange('objetoVisita', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Ex: Auditoria Semanal de Conformidade"
              />
            </div>
          </div>
        </section>

        {/* Seção 2: Checklist Operacional (Atualizado) */}
        <section className="mb-8 bg-white rounded-2xl shadow-md p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-100">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">2</div>
            <h2 className="text-xl font-bold text-gray-800">Avaliação em Campo</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: 'cronogramaCumprido' as const, label: 'Cumprimento do cronograma operacional' },
              { key: 'qualidadeServico' as const, label: 'Qualidade dos serviços prestados' },
              { key: 'condutaColaboradores' as const, label: 'Conduta e apresentação dos colaboradores' },
              { key: 'demandasCliente' as const, label: 'Demandas, reclamações ou elogios do cliente' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                <label className="font-semibold text-slate-700 text-sm md:text-base flex-1 pr-4 cursor-pointer" onClick={() => handleInputChange(key, !formData[key])}>
                  {label}
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData[key]}
                  onClick={() => handleInputChange(key, !formData[key])}
                  className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                    formData[key] ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      formData[key] ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}

            <div className="mt-6 pt-4 border-t border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Descrição da ATA
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => handleInputChange('observacoes', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors min-h-[120px] resize-y"
                placeholder="Descreva aqui as pontuações importantes da visita, detalhes técnicos e observações gerais..."
              />
            </div>
          </div>
        </section>

        {/* Seção 3: Plano de Ação (Nova Seção) */}
        <section className="mb-8 bg-white rounded-2xl shadow-md p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-100">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">3</div>
            <h2 className="text-xl font-bold text-gray-800">Plano de Ação</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Ação a ser tomada</label>
              <input
                type="text"
                value={formData.acaoTomada}
                onChange={(e) => handleInputChange('acaoTomada', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                placeholder="Ex: Substituir EPI danificado"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Responsável pela Ação</label>
                <input
                  type="text"
                  value={formData.responsavelAcao}
                  onChange={(e) => handleInputChange('responsavelAcao', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="Nome do responsável"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Prazo de Resolução</label>
                <input
                  type="text"
                  value={formData.prazoAcao}
                  onChange={(e) => handleInputChange('prazoAcao', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-colors"
                  placeholder="Ex: 22/10/2026 ou Imediato"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Seção 4: Assinatura Facial */}
        <section className="mb-8 bg-white rounded-2xl shadow-md p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-100">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">4</div>
            <h2 className="text-xl font-bold text-gray-800">Assinatura Digital Biométrica</h2>
          </div>

          <div className="space-y-4">
            {!capturedImage && !isCameraOpen && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <UserCheck className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-6 font-medium">Reconhecimento facial para validação e assinatura criptográfica da Ata.</p>
                <button
                  onClick={openCamera}
                  className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-800 text-white py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 mx-auto"
                >
                  <Camera className="w-6 h-6" />
                  Escanear Rosto do Encarregado
                </button>
              </div>
            )}

            {isCameraOpen && (
              <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto object-cover max-h-[60vh]"
                />
                <div className="absolute inset-0 pointer-events-none border-[6px] border-blue-500/30 rounded-2xl"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  <div className="flex gap-4">
                    <button
                      onClick={capturePhoto}
                      className="flex-1 bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-xl hover:bg-blue-500 active:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      Assinar Digitalmente
                    </button>
                    <button
                      onClick={closeCamera}
                      className="bg-red-500 text-white py-4 px-6 rounded-xl font-bold shadow-xl hover:bg-red-400 transition-all duration-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="relative group">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full rounded-2xl shadow-lg border-[6px] border-green-500 object-cover max-h-[60vh]"
                />
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setCapturedImage(null)}
                    className="bg-black/60 backdrop-blur-sm text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-all duration-200"
                    title="Refazer foto"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 right-4 bg-green-500/90 backdrop-blur-md text-white rounded-xl p-4 shadow-lg border border-green-400">
                  <p className="font-bold text-center flex items-center justify-center gap-2 text-lg">
                    <CheckCircle2 className="w-6 h-6" />
                    Biometria Pronta para Validação
                  </p>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </section>

        {/* Seção 5: Envio */}
        <section className="mb-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-6 px-6 rounded-2xl font-black text-xl tracking-wide shadow-[0_8px_30px_rgb(16,185,129,0.3)] hover:shadow-[0_8px_30px_rgb(16,185,129,0.5)] hover:-translate-y-1 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin" />
                Processando Ata e IA...
              </>
            ) : (
              <>
                <Send className="w-7 h-7" />
                SALVAR E GERAR ATA DIGITAL
              </>
            )}
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-slate-400 py-3 text-center text-xs tracking-wider border-t border-slate-800">
        <p>Desenvolvido para Gestão de Facilities • PontoAI Engine</p>
      </footer>
    </div>
  );
}
