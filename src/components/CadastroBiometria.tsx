import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, X, Loader2, UserPlus, Shield, Scan, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Link } from 'react-router-dom';

interface FormData {
  nome: string;
  cargo: string;
  cpf: string;
}

export default function CadastroBiometria() {
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    cargo: '',
    cpf: '',
  });

  // Estado da câmera
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estado de envio
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Formatação de CPF
  const formatCPF = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

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

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false,
      });

      setStream(mediaStream);
      setIsCameraOpen(true);
    } catch {
      toast.error('Erro ao acessar câmera. Permita o acesso para continuar.');
    }
  };

  const closeCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  }, [stream]);

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

  const handleInputChange = (field: keyof FormData, value: string) => {
    if (field === 'cpf') {
      setFormData(prev => ({ ...prev, [field]: formatCPF(value) }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', cargo: '', cpf: '' });
    setCapturedImage(null);
    setIsSuccess(false);
  };

  const handleSubmit = async () => {
    // Validações locais
    if (!formData.nome.trim()) {
      toast.error('Preencha o nome do colaborador');
      return;
    }
    if (!formData.cargo.trim()) {
      toast.error('Preencha o cargo do colaborador');
      return;
    }
    if (!formData.cpf.trim()) {
      toast.error('Preencha o CPF ou Matrícula');
      return;
    }
    if (!capturedImage) {
      toast.error('Capture uma foto do rosto antes de cadastrar');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Verificação de Qualidade do Rosto
      toast.info('Verificando qualidade da foto...', { id: 'cadastro-toast' });
      const verifyResponse = await fetch('http://localhost:7860/verificar_rosto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagem_base64: capturedImage }),
      });

      if (!verifyResponse.ok) {
        toast.error('Erro ao verificar a foto no servidor.', { id: 'cadastro-toast' });
        setIsSubmitting(false);
        return;
      }

      const verifyData = await verifyResponse.json();
      
      if (!verifyData.rosto_detectado || verifyData.qualidade === 'ruim') {
        toast.error(verifyData.mensagem || 'Foto inválida. Tire outra foto.', { 
          id: 'cadastro-toast',
          duration: 6000 
        });
        setIsSubmitting(false);
        return;
      }

      // 2. Cadastro Real
      toast.loading('Salvando e treinando IA...', { id: 'cadastro-toast' });
      const payload = {
        nome: formData.nome.trim(),
        cargo: formData.cargo.trim(),
        cpf: formData.cpf.replace(/\D/g, ''),
        imagem_base64: capturedImage,
      };

      const backendUrl = 'http://localhost:7860/cadastrar_face';
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.mensagem || '✅ Rosto cadastrado com sucesso!', {
          id: 'cadastro-toast',
          duration: 5000,
        });
        setIsSuccess(true);
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.detail || 'Erro ao cadastrar rosto.', { id: 'cadastro-toast' });
      }
    } catch {
      toast.error('Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 7860.', { id: 'cadastro-toast' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 font-sans flex flex-col items-center py-10 px-4">
      <Toaster position="top-center" richColors />

      {/* Partículas de fundo decorativas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navegação superior */}
      <div className="w-full max-w-3xl mb-6 relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-emerald-400/80 hover:text-emerald-300 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para Ata de Reunião
        </Link>
      </div>

      <main className="w-full max-w-3xl relative z-10">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-2xl p-8 shadow-2xl shadow-emerald-900/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Cadastro Biométrico
              </h1>
              <p className="text-emerald-100/80 text-sm mt-1">
                Registre o rosto do colaborador para validação facial na Ata
              </p>
            </div>
          </div>
          
          {/* Steps indicator */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white text-emerald-700 flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-white/90 text-xs font-medium hidden sm:inline">Dados pessoais</span>
            </div>
            <div className="flex-1 h-px bg-white/30" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/30 text-white flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-white/70 text-xs font-medium hidden sm:inline">Captura facial</span>
            </div>
            <div className="flex-1 h-px bg-white/30" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/30 text-white flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-white/70 text-xs font-medium hidden sm:inline">Confirmar</span>
            </div>
          </div>
        </div>

        {/* Main form card */}
        <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-b-2xl p-6 lg:p-10 mb-10">
          
          {isSuccess ? (
            /* Tela de Sucesso */
            <div className="text-center py-16">
              <div className="relative inline-block mb-6">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <div className="absolute inset-0 w-24 h-24 bg-emerald-400/30 rounded-full mx-auto animate-ping" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Cadastro Realizado!</h2>
              <p className="text-slate-500 mb-2">
                <strong className="text-emerald-700">{formData.nome}</strong> foi registrado com sucesso.
              </p>
              <p className="text-sm text-slate-400 mb-8">
                O rosto já pode ser utilizado para validação biométrica nas Atas.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={resetForm}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-600/30"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar Outro
                </button>
                <Link
                  to="/"
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Seção 1: Dados do Colaborador */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Dados do Colaborador</h2>
                    <p className="text-xs text-slate-400">Preencha as informações de identificação</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Nome Completo <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none text-slate-800 placeholder:text-slate-400"
                      placeholder="Ex: João Carlos da Silva"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Cargo <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => handleInputChange('cargo', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none text-slate-800 placeholder:text-slate-400"
                      placeholder="Ex: Encarregado de Limpeza"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      CPF / Matrícula <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => handleInputChange('cpf', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all outline-none text-slate-800 placeholder:text-slate-400"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                </div>
              </section>

              {/* Divisor */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs text-slate-400 uppercase tracking-widest font-medium">
                    Captura Biométrica
                  </span>
                </div>
              </div>

              {/* Seção 2: WebCam */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Scan className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Reconhecimento Facial</h2>
                    <p className="text-xs text-slate-400">Tire uma foto clara e frontal do rosto</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {!capturedImage && !isCameraOpen && (
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-emerald-400 transition-colors group">
                      <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 group-hover:shadow-emerald-200 transition-shadow">
                        <Camera className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <p className="text-slate-500 mb-2 text-sm">Nenhuma foto capturada</p>
                      <p className="text-xs text-slate-400 mb-6">
                        Posicione o rosto de frente para a câmera, em local bem iluminado
                      </p>
                      <button
                        onClick={openCamera}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-8 rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Camera className="w-4 h-4" />
                        Abrir Câmera
                      </button>
                    </div>
                  )}

                  {isCameraOpen && (
                    <div className="relative bg-black rounded-2xl overflow-hidden aspect-video min-h-[300px] flex items-center justify-center shadow-2xl">
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

                      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={capturePhoto}
                            className="bg-emerald-500 text-white py-3 px-8 rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Capturar Foto
                          </button>
                          <button
                            onClick={closeCamera}
                            className="bg-white/20 backdrop-blur text-white py-3 px-5 rounded-xl font-medium text-sm hover:bg-white/30 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="relative group">
                      <div className="flex flex-col items-center">
                        <div className="relative w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-emerald-500/30">
                          <img
                            src={capturedImage}
                            alt="Foto capturada do colaborador"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/30 to-transparent" />
                        </div>
                        
                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm font-semibold">Foto Pronta</span>
                          </div>
                          <button
                            onClick={() => { setCapturedImage(null); openCamera(); }}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Refazer
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </section>

              {/* Botão de Envio */}
              <section className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <Link
                    to="/"
                    className="px-6 py-3 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                  >
                    Cancelar
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-8 rounded-xl font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processando Biometria...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Cadastrar Biometria
                      </>
                    )}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-slate-500 py-6 text-center text-xs tracking-wide relative z-10">
        <p>Módulo de Cadastro Biométrico • PontoAI Engine</p>
      </footer>
    </div>
  );
}
