import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertCircle, Upload, Loader2, Cloud } from 'lucide-react';
import { uploadToCloudinary } from '../../lib/cloudinary.ts';
import { compressImageFile } from '../../lib/image-compression.ts';
import { validateFile } from '../../lib/file-uploader.ts';

interface AttendanceCameraProps {
  onCapture: (photoBase64: string) => void;
  capturedPhoto: string | null;
  onRetake: () => void;
}

export function AttendanceCamera({ onCapture, capturedPhoto, onRetake }: AttendanceCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState<boolean>(false);

  const startCamera = useCallback(async () => {
    if (capturedPhoto) return;
    setIsLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera secara langsung.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user', // Kamera depan (selfie)
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          setIsLoading(false);
        };
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const error = err as Error;
      console.warn('Gagal mengakses kamera:', error.message);
      setCameraError(
        'Kamera tidak dapat diakses atau izin kamera ditolak. Silakan izinkan akses kamera di browser Anda atau unggah foto selfie dari perangkat.'
      );
    }
  }, [capturedPhoto]);

  // Mulai stream kamera saat komponen aktif dan belum ada foto yang diambil
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // Tangkap gambar dari video stream ke canvas
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontal agar mirror effect
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL('image/jpeg', 0.85);

    // Hentikan stream kamera untuk menghemat daya
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }

    // Set preview langsung
    onCapture(base64Image);

    // Upload ke Cloudinary di background
    try {
      setIsUploadingToCloud(true);
      const res = await uploadToCloudinary(base64Image, {
        folder: 'absenku/attendance',
        resourceType: 'image',
      });
      if (res.url) {
        onCapture(res.url);
      }
    } catch (err) {
      console.warn('Cloudinary upload fallback to base64:', err);
    } finally {
      setIsUploadingToCloud(false);
    }
  };

  // Upload foto manual dari galeri perangkat bila kamera tidak tersedia
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Validasi berkas
      const validation = validateFile(file);
      if (!validation.isValid || validation.category !== 'image') {
        alert(validation.error || 'Harap unggah berkas foto/gambar yang valid (maksimal 5 MB).');
        e.target.value = '';
        return;
      }

      try {
        setIsUploadingToCloud(true);
        // 2. Kompresi gambar di browser sebelum dikirim ke cloud
        const compressedBase64 = await compressImageFile(file, 800, 800, 0.8);
        onCapture(compressedBase64);

        // 3. Upload gambar terkompresi ke Cloudinary
        const res = await uploadToCloudinary(compressedBase64, {
          folder: 'absenku/attendance',
          resourceType: 'image',
        });
        if (res.url) {
          onCapture(res.url);
        }
      } catch (err) {
        console.warn('Cloudinary upload fallback to compressed base64:', err);
      } finally {
        setIsUploadingToCloud(false);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="w-full flex flex-col items-center font-sans">
      {/* Jika sudah ada foto yang diambil */}
      {capturedPhoto ? (
        <div className="w-full flex flex-col items-center gap-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm w-full max-w-sm aspect-4/3 bg-slate-950">
            <img
              src={capturedPhoto}
              alt="Hasil Tangkapan Selfie"
              className="w-full h-full object-cover"
            />
            {isUploadingToCloud ? (
              <div className="absolute top-3 left-3 bg-blue-50 text-[#1E3A8A] border border-blue-200/80 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menyimpan Foto...
              </div>
            ) : (
              <div className="absolute top-3 left-3 bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Selfie Terverifikasi
              </div>
            )}
            <div className="absolute bottom-2 right-3 text-[11px] text-white/80 bg-slate-900/80 px-2 py-0.5 rounded font-mono">
              {new Date().toLocaleTimeString('id-ID')} WIB
            </div>
          </div>

          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-300 shadow-xs hover:-translate-y-0.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Ambil Ulang Selfie
          </button>
        </div>
      ) : (
        /* Tampilan Live Kamera Video */
        <div className="w-full flex flex-col items-center gap-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 w-full max-w-sm aspect-4/3 flex items-center justify-center shadow-sm">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-900/90 z-20">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-xs">Menyiapkan kamera webcam...</span>
              </div>
            )}

            {cameraError ? (
              <div className="p-5 text-center text-slate-300 flex flex-col items-center gap-2.5 max-w-xs">
                <AlertCircle className="w-6 h-6 text-amber-400" />
                <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                
                <div className="mt-2 flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Buka Kamera Lagi
                  </button>

                  <label className="cursor-pointer px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Foto dari Perangkat
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
          </div>

          {/* Hidden Canvas untuk snapshot */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Capture Trigger Button */}
          {!cameraError && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!cameraActive}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-bold rounded-xl shadow-xs transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Camera className="w-3.5 h-3.5" />
                Ambil Foto Selfie
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
