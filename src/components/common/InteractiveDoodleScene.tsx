import React, { useState, useEffect, useRef } from 'react';

/**
 * Interactive Blob Crowd Illustration (Full Half-Screen, All Smiling, All Two-Eyed, Balanced Large Size).
 * - Ukuran besar memenuhi setengah layar sebelah kiri (full height & width).
 * - Karakter hijau & abu-abu di belakang kini dibuat BESAR, montok, dan gagah seimbang dengan karakter lainnya.
 * - Semua 12 karakter memiliki DUA MATA (sepasang mata titik hitam dengan catchlight berkilau).
 * - Semua karakter TERSENYUM manis dan ramah.
 * - Seluruh mata mengikuti kursor mouse secara interaktif dan presisi.
 */

// Konfigurasi 12 Karakter Blob (Masing-masing 2 mata = 24 mata titik hitam)
const BLOB_EYES = [
  // 1. Blob Hijau Limau (Kiri Belakang) - Kini Dibuat Lebih Besar & Lebar
  { id: 'lime_l', cx: 70, cy: 205, r: 7.5, maxOffset: 7 },
  { id: 'lime_r', cx: 130, cy: 205, r: 7.5, maxOffset: 7 },

  // 2. Blob Mint / Toska (Kiri-Tengah Belakang) - Besar
  { id: 'mint_l', cx: 218, cy: 245, r: 7, maxOffset: 6.5 },
  { id: 'mint_r', cx: 262, cy: 245, r: 7, maxOffset: 6.5 },

  // 3. Blob Biru Keabu-abuan / Slate (Tengah Belakang) - Kini Dibuat Lebih Besar & Lebar
  { id: 'slate_l', cx: 362, cy: 235, r: 7, maxOffset: 6.5 },
  { id: 'slate_r', cx: 414, cy: 235, r: 7, maxOffset: 6.5 },

  // 4. Blob Ungu Lavender (Tengah-Kanan Belakang) - Besar
  { id: 'purple_l', cx: 475, cy: 220, r: 7, maxOffset: 6.5 },
  { id: 'purple_r', cx: 525, cy: 220, r: 7, maxOffset: 6.5 },

  // 5. Blob Biru Langit Besar (Kanan Belakang - Menjulang)
  { id: 'sky_l', cx: 675, cy: 195, r: 7.5, maxOffset: 7 },
  { id: 'sky_r', cx: 735, cy: 195, r: 7.5, maxOffset: 7 },

  // 6. Blob Oranye Persik Besar (Kiri Tengah)
  { id: 'peach_l', cx: 130, cy: 365, r: 7.5, maxOffset: 7 },
  { id: 'peach_r', cx: 195, cy: 365, r: 7.5, maxOffset: 7 },

  // 7. Blob Oranye Koral (Tengah)
  { id: 'coral_l', cx: 320, cy: 420, r: 6.5, maxOffset: 6.5 },
  { id: 'coral_r', cx: 375, cy: 420, r: 6.5, maxOffset: 6.5 },

  // 8. Blob Kuning Mentega Pastel (Kanan Tengah)
  { id: 'yellow_l', cx: 545, cy: 435, r: 6.5, maxOffset: 6.5 },
  { id: 'yellow_r', cx: 595, cy: 435, r: 6.5, maxOffset: 6.5 },

  // 9. Blob Hijau Chartreuse Neon (Kanan Samping)
  { id: 'chartreuse_l', cx: 720, cy: 425, r: 6, maxOffset: 6 },
  { id: 'chartreuse_r', cx: 765, cy: 425, r: 6, maxOffset: 6 },

  // 10. Blob Pink Permen (Depan Kiri Bawah)
  { id: 'pink_l', cx: 145, cy: 535, r: 7, maxOffset: 7 },
  { id: 'pink_r', cx: 205, cy: 535, r: 7, maxOffset: 7 },

  // 11. Blob Pink Salmon (Depan Tengah Bawah)
  { id: 'salmon_l', cx: 430, cy: 585, r: 6.5, maxOffset: 6.5 },
  { id: 'salmon_r', cx: 485, cy: 585, r: 6.5, maxOffset: 6.5 },

  // 12. Blob Merah Koral Muda (Depan Kanan Bawah)
  { id: 'red_l', cx: 665, cy: 575, r: 6.5, maxOffset: 6.5 },
  { id: 'red_r', cx: 720, cy: 575, r: 6.5, maxOffset: 6.5 },
];

export function InteractiveDoodleScene({ className = "w-full h-full" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState({ x: 400, y: 400 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Hitung pergeseran mata mengikuti kursor mouse
  const getEyeOffset = (cx: number, cy: number, maxOffset: number) => {
    if (!svgRef.current) return { dx: 0, dy: 0 };
    const svg = svgRef.current;
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
    const offset = Math.min(maxOffset, dist * 0.04);
    return {
      dx: Math.cos(angle) * offset,
      dy: Math.sin(angle) * offset,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-end justify-center bg-white select-none overflow-hidden relative ${className}`}
    >
      <div className="relative w-full h-full flex items-end justify-center">
        <svg
          ref={svgRef}
          viewBox="0 0 800 750"
          className="w-full h-full object-cover object-bottom relative z-10"
          preserveAspectRatio="xMidYBottom slice"
        >
          {/* ======================================================== */}
          {/* LAYER 1: KARAKTER BLOB PALING BELAKANG (BESAR & SEIMBANG) */}
          {/* ======================================================== */}

          {/* 1. Blob Hijau Limau (Kiri Belakang - Kini Dibuat Besar & Membulat) */}
          <path
            d="M -40 680 
               C -40 430, 0 135, 100 135 
               C 200 135, 230 400, 225 680 Z"
            fill="#9ACD75"
          />

          {/* 2. Blob Toska / Mint Cyan (Kiri-Tengah Belakang) */}
          <path
            d="M 130 650 
               C 130 460, 160 210, 260 210 
               C 360 210, 390 420, 390 650 
               L 130 650 Z"
            fill="#6CE5C8"
          />

          {/* 3. Blob Biru Keabu-abuan / Slate (Tengah Belakang - Bentuk Organik Halus Ramah, Tidak Kaku & Tidak Lancip) */}
          <path
            d="M 290 680 
               C 288 380, 318 170, 388 170 
               C 458 170, 488 380, 485 680 Z"
            fill="#576C87"
          />

          {/* 4. Blob Ungu Lavender (Tengah-Kanan Belakang) */}
          <path
            d="M 380 650 
               C 380 480, 400 180, 495 180 
               C 580 180, 610 260, 610 400 
               C 610 470, 615 540, 595 650 
               L 380 650 Z"
            fill="#756792"
          />

          {/* 5. Blob Biru Langit Besar (Kanan Belakang - Menjulang) */}
          <path
            d="M 520 680 
               C 520 400, 600 140, 715 140 
               C 830 140, 850 360, 850 680 Z"
            fill="#53A2BD"
          />

          {/* ======================================================== */}
          {/* LAYER 2: KARAKTER BLOB LAPISAN TENGAH */}
          {/* ======================================================== */}

          {/* 6. Blob Oranye Persik Besar (Kiri Tengah) */}
          <path
            d="M -50 750 
               C -50 500, 30 310, 165 310 
               C 295 310, 335 480, 335 750 Z"
            fill="#FFA573"
          />

          {/* 7. Blob Oranye Koral (Tengah) */}
          <path
            d="M 175 750 
               C 175 520, 240 370, 350 370 
               C 460 370, 510 500, 510 750 Z"
            fill="#FA8065"
          />

          {/* 8. Blob Kuning Mentega Pastel (Kanan Tengah) */}
          <path
            d="M 430 750 
               C 430 540, 500 385, 605 385 
               C 705 385, 725 520, 725 750 Z"
            fill="#FCE16B"
          />

          {/* 9. Blob Hijau Chartreuse Neon (Kanan Samping) */}
          <path
            d="M 620 750 
               C 620 540, 690 390, 775 390 
               C 830 390, 850 480, 850 750 Z"
            fill="#D5FF57"
          />

          {/* ======================================================== */}
          {/* LAYER 3: KARAKTER BLOB LAPISAN DEPAN PALING BAWAH */}
          {/* ======================================================== */}

          {/* 10. Blob Pink Permen (Depan Kiri Bawah) */}
          <path
            d="M -50 750 
               C -50 600, 30 460, 175 460 
               C 320 460, 345 610, 345 750 Z"
            fill="#F677B2"
          />

          {/* 11. Blob Pink Salmon (Depan Tengah Bawah) */}
          <path
            d="M 290 750 
               C 290 620, 360 520, 460 520 
               C 560 520, 610 630, 610 750 Z"
            fill="#FA6E92"
          />

          {/* 12. Blob Merah Koral Muda (Depan Kanan Bawah) */}
          <path
            d="M 530 750 
               C 530 610, 600 505, 705 505 
               C 810 505, 850 610, 850 750 Z"
            fill="#F45F78"
          />

          {/* ======================================================== */}
          {/* LAYER 4: SEMUA KARAKTER TERSENYUM MANIS :) */}
          {/* ======================================================== */}
          <g id="blob-mouths" stroke="#111827" strokeWidth="3.6" strokeLinecap="round" fill="none">
            {/* 1. Blob Hijau Limau: senyum manis :) */}
            <path d="M 88 238 Q 100 255 112 238" strokeWidth="4" />

            {/* 2. Blob Mint: senyum manis :) */}
            <path d="M 230 275 Q 240 290 250 275" strokeWidth="3.8" />

            {/* 3. Blob Biru Abu-abu: senyum manis :) */}
            <path d="M 376 267 Q 388 282 400 267" strokeWidth="3.8" />

            {/* 4. Blob Ungu: senyum manis :) */}
            <path d="M 490 250 Q 500 264 510 250" strokeWidth="3.8" />

            {/* 5. Blob Biru Langit: senyum manis :) */}
            <path d="M 693 225 Q 705 240 717 225" strokeWidth="4" />

            {/* 6. Blob Oranye Peach: senyum manis lebar :) */}
            <path d="M 148 402 Q 163 420 178 402" strokeWidth="4" />

            {/* 7. Blob Oranye Koral: senyum manis :) */}
            <path d="M 338 450 Q 348 464 358 450" strokeWidth="3.8" />

            {/* 8. Blob Kuning: senyum manis lebar :) */}
            <path d="M 560 465 Q 570 480 580 465" strokeWidth="3.8" />

            {/* 9. Blob Chartreuse: senyum manis :) */}
            <path d="M 735 450 Q 743 460 751 450" />

            {/* 10. Blob Pink Permen: senyum manis lebar :) */}
            <path d="M 160 575 Q 175 595 190 575" strokeWidth="4.2" />

            {/* 11. Blob Pink Salmon: senyum manis :) */}
            <path d="M 445 615 Q 458 632 470 615" strokeWidth="3.8" />

            {/* 12. Blob Merah Koral: senyum manis :) */}
            <path d="M 680 605 Q 693 622 705 605" strokeWidth="3.8" />
          </g>

          {/* ======================================================== */}
          {/* LAYER 5: SEMUA MEMILIKI DUA MATA YANG MENGIKUTI KURSOR */}
          {/* ======================================================== */}
          <g id="interactive-blob-eyes">
            {BLOB_EYES.map((eye) => {
              const { dx, dy } = getEyeOffset(eye.cx, eye.cy, eye.maxOffset);

              return (
                <g key={eye.id}>
                  {/* Titik Hitam Mata yang Bergerak Mengikuti Kursor */}
                  <circle
                    cx={eye.cx + dx}
                    cy={eye.cy + dy}
                    r={eye.r}
                    fill="#111827"
                  />
                  {/* Catchlight Kecil Putih Berkilau */}
                  <circle
                    cx={eye.cx + dx - 1.2}
                    cy={eye.cy + dy - 1.2}
                    r={1.2}
                    fill="#FFFFFF"
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
