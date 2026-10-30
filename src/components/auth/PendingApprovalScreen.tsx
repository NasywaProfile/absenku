import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { User } from '../../types/index.ts';
import { AppStorage } from '../../lib/storage.ts';
import { TextShimmer } from '../ui/shimmer-text.tsx';

interface PendingApprovalScreenProps {
  currentUser: User;
  onApproved: (user: User) => void;
  onLogout?: () => void;
  onSwitchToAdmin?: () => void;
}

export function PendingApprovalScreen({
  currentUser,
  onApproved,
  onLogout,
}: PendingApprovalScreenProps) {
  const [mousePos, setMousePos] = useState({ x: 500, y: 300 });
  const blobSvgRef = useRef<SVGSVGElement>(null);

  // Mouse move listener untuk mengarahkan pandangan mata doodle
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Polling otomatis setiap 2 detik untuk mendeteksi jika Admin/Super Admin sudah meng-ACC akun
  useEffect(() => {
    const checkStatus = () => {
      const allUsers = AppStorage.getUsers();
      const freshUser = allUsers.find((u) => u.id === currentUser.id);

      if (freshUser && freshUser.status === 'ACTIVE') {
        // Akun telah di-ACC oleh Admin/Super Admin!
        AppStorage.setSessionUser(freshUser.id);
        onApproved(freshUser);
      }
    };

    const intervalId = setInterval(checkStatus, 2000);
    return () => clearInterval(intervalId);
  }, [currentUser.id, onApproved]);

  // Kalkulasi pergeseran pupil mata pada SVG relatif terhadap kursor mouse
  const calculateEyeOffset = (cx: number, cy: number, maxOffset = 3) => {
    if (!blobSvgRef.current) return { dx: 0, dy: 0 };
    const svg = blobSvgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = mousePos.x;
    pt.y = mousePos.y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { dx: 0, dy: 0 };

    const svgPoint = pt.matrixTransform(ctm.inverse());
    const deltaX = svgPoint.x - cx;
    const deltaY = svgPoint.y - cy;
    const dist = Math.hypot(deltaX, deltaY);
    if (dist === 0) return { dx: 0, dy: 0 };

    const angle = Math.atan2(deltaY, deltaX);
    const offset = Math.min(maxOffset, dist * 0.05);
    return {
      dx: Math.cos(angle) * offset,
      dy: Math.sin(angle) * offset,
    };
  };

  const leftEyeOffset = calculateEyeOffset(38, 45, 2.5);
  const rightEyeOffset = calculateEyeOffset(62, 45, 2.5);

  return (
    <div className="relative min-h-screen w-full bg-white flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white overflow-hidden select-none">
      {/* Tombol Silang (X) di Pojok Kanan Atas menuju Halaman Masuk / Login */}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="absolute top-5 right-5 sm:top-6 sm:right-6 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          title="Keluar ke Halaman Masuk"
          aria-label="Keluar ke Halaman Masuk"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Container Tengah: Doodle Biru Lembut + Tulisan Shimmer */}
      <div className="flex flex-col items-center justify-center text-center gap-4">
        {/* 1 Doodle Kecil Warna Biru Sesuai Referensi Gambar */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
          <svg
            ref={blobSvgRef}
            viewBox="0 0 100 100"
            className="w-full h-full object-contain"
          >
            {/* Badan Blob Biru (#4796B3 sesuai referensi gambar) */}
            <path
              d="M 14 88 
                 C 12 50, 22 15, 52 15 
                 C 78 15, 88 48, 86 88 
                 C 86 92, 14 92, 14 88 Z"
              fill="#4796B3"
            />

            {/* Senyuman Lucu Hitam Pekat */}
            <path
              d="M 43 59 Q 50 66 57 59"
              stroke="#111827"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* 2 Mata Interaktif yang Melirik Mengikuti Kursor */}
            {/* Mata Kiri */}
            <circle
              cx={38 + leftEyeOffset.dx}
              cy={45 + leftEyeOffset.dy}
              r={4}
              fill="#111827"
            />
            <circle
              cx={38 + leftEyeOffset.dx - 1}
              cy={45 + leftEyeOffset.dy - 1}
              r={1.1}
              fill="#FFFFFF"
            />

            {/* Mata Kanan */}
            <circle
              cx={62 + rightEyeOffset.dx}
              cy={45 + rightEyeOffset.dy}
              r={4}
              fill="#111827"
            />
            <circle
              cx={62 + rightEyeOffset.dx - 1}
              cy={45 + rightEyeOffset.dy - 1}
              r={1.1}
              fill="#FFFFFF"
            />
          </svg>
        </div>

        {/* Tulisan Sinkronisasi Akun dengan Animasi Shimmer */}
        <TextShimmer
          duration={2}
          spread={2}
          className="font-light text-base sm:text-lg tracking-tight text-center select-none [--base-color:#a1a1aa] [--base-gradient-color:#000000]"
        >
          Menyinkronkan akun Anda
        </TextShimmer>
      </div>
    </div>
  );
}
