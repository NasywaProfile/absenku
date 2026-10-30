import React from 'react';

// 1. Ilustrasi Presensi & GPS Geofence (Hero Clock)
export function HeroClockIllustration({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Soft Glow Circle */}
      <circle cx="80" cy="80" r="70" fill="#EEF2FF" />
      <circle cx="80" cy="80" r="54" fill="#E0E7FF" stroke="#C7D2FE" strokeWidth="2" strokeDasharray="4 4" />
      
      {/* Clock Outer Ring */}
      <rect x="36" y="36" width="88" height="88" rx="28" fill="white" stroke="#4F46E5" strokeWidth="3" className="shadow-xs" />
      
      {/* Clock Dial & Hands */}
      <circle cx="80" cy="80" r="32" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
      <path d="M80 60V80L94 88" stroke="#1E3A8A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* GPS Location Pin Accent */}
      <g transform="translate(102, 32)">
        <circle cx="16" cy="16" r="16" fill="#10B981" />
        <path d="M16 8C12.134 8 9 11.134 9 15C9 20.25 16 25 16 25C16 25 23 20.25 23 15C23 11.134 19.866 8 16 8ZM16 17C14.8954 17 14 16.1046 14 15C14 13.8954 14.8954 13 16 13C17.1046 13 18 13.8954 18 15C18 16.1046 17.1046 17 16 17Z" fill="white" />
      </g>

      {/* Verified Check Badge Accent */}
      <g transform="translate(24, 102)">
        <circle cx="14" cy="14" r="14" fill="#4F46E5" />
        <path d="M9 14L12.5 17.5L19 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// 2. Ilustrasi Papan Tugas / Task Kosong (Empty Task)
export function EmptyStateTaskIllustration({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="80" cy="80" r="64" fill="#F1F5F9" />
      
      {/* Board Base */}
      <rect x="42" y="38" width="76" height="92" rx="16" fill="white" stroke="#CBD5E1" strokeWidth="2.5" />
      <path d="M60 30H100V42H60V30Z" fill="#1E3A8A" rx="4" />
      <circle cx="80" cy="36" r="3" fill="white" />
      
      {/* Task Lines */}
      <rect x="54" y="56" width="52" height="8" rx="4" fill="#E2E8F0" />
      <rect x="54" y="72" width="38" height="8" rx="4" fill="#EEF2FF" />
      
      {/* Check Item 1 */}
      <rect x="54" y="88" width="14" height="14" rx="4" fill="#10B981" />
      <path d="M58 95L61 98L64 92" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="74" y="91" width="32" height="8" rx="4" fill="#CBD5E1" />
      
      {/* Check Item 2 */}
      <rect x="54" y="108" width="14" height="14" rx="4" fill="#E2E8F0" />
      <rect x="74" y="111" width="24" height="8" rx="4" fill="#E2E8F0" />

      {/* Sparkle Accent */}
      <path d="M124 50L126.5 56L132.5 58.5L126.5 61L124 67L121.5 61L115.5 58.5L121.5 56L124 50Z" fill="#F59E0B" />
    </svg>
  );
}

// 3. Ilustrasi Perizinan & WFH (Leave Request)
export function LeaveRequestIllustration({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="80" cy="80" r="64" fill="#FEF3C7" />
      
      {/* Calendar Base */}
      <rect x="38" y="44" width="84" height="80" rx="18" fill="white" stroke="#F59E0B" strokeWidth="2.5" />
      <path d="M38 44C38 34.0589 46.0589 26 56 26H104C113.941 26 122 34.0589 122 44V56H38V44Z" fill="#F59E0B" />
      
      {/* Binder Rings */}
      <rect x="56" y="20" width="6" height="12" rx="3" fill="#B45309" />
      <rect x="98" y="20" width="6" height="12" rx="3" fill="#B45309" />
      
      {/* House / WFH Icon inside Calendar */}
      <path d="M80 68L62 82V104H74V92H86V104H98V82L80 68Z" fill="#1E3A8A" />
      <rect x="77" y="80" width="6" height="8" rx="1" fill="#FEF3C7" />

      {/* Airplane / Trip Accent */}
      <g transform="translate(102, 88)">
        <circle cx="16" cy="16" r="16" fill="#818CF8" />
        <path d="M22 13L15 15L11 11L9.5 12L12 16L9 18.5L7 17.5L6 18.5L9 22L12.5 25L13.5 24L12.5 22L15 19L19 21.5L20 20L16 16L22 13Z" fill="white" />
      </g>
    </svg>
  );
}

// 4. Ilustrasi Sukses & Pengesahan (Success Victory Badge)
export function SuccessCheckIllustration({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="60" cy="60" r="50" fill="#ECFDF5" />
      <circle cx="60" cy="60" r="38" fill="#10B981" />
      <path d="M44 60L54 70L76 48" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Confetti Dots */}
      <circle cx="28" cy="36" r="4" fill="#F59E0B" />
      <circle cx="92" cy="38" r="5" fill="#4F46E5" />
      <circle cx="90" cy="84" r="3.5" fill="#10B981" />
      <circle cx="32" cy="88" r="4.5" fill="#6366F1" />
    </svg>
  );
}

// 5. Ilustrasi Lokasi Kantor & Geofence (Office Map Pin)
export function GeofenceIllustration({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="80" cy="80" r="64" fill="#E0F2FE" />
      
      {/* Map Grid Base */}
      <rect x="36" y="48" width="88" height="72" rx="16" fill="white" stroke="#0284C7" strokeWidth="2.5" />
      <line x1="36" y1="72" x2="124" y2="72" stroke="#E0F2FE" strokeWidth="3" />
      <line x1="36" y1="96" x2="124" y2="96" stroke="#E0F2FE" strokeWidth="3" />
      <line x1="68" y1="48" x2="68" y2="120" stroke="#E0F2FE" strokeWidth="3" />
      <line x1="96" y1="48" x2="96" y2="120" stroke="#E0F2FE" strokeWidth="3" />

      {/* Geofence Pulsing Circle */}
      <circle cx="80" cy="80" r="28" fill="#0284C7" fillOpacity="0.15" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 3" />

      {/* Office Building Icon */}
      <rect x="70" y="68" width="20" height="28" rx="2" fill="#1E3A8A" />
      <rect x="74" y="72" width="4" height="4" fill="#93C5FD" />
      <rect x="82" y="72" width="4" height="4" fill="#93C5FD" />
      <rect x="74" y="80" width="4" height="4" fill="#93C5FD" />
      <rect x="82" y="80" width="4" height="4" fill="#93C5FD" />

      {/* Pin Overlay */}
      <g transform="translate(80, 42)">
        <path d="M0 -16C-8.83656 -16 -16 -8.83656 -16 0C-16 12 -0 24 -0 24C-0 24 16 12 16 0C16 -8.83656 8.83656 -16 0 -16ZM0 -4C2.20914 -4 4 -2.20914 4 0C4 2.20914 2.20914 4 0 4C-2.20914 4 -4 2.20914 -4 0C-4 -2.20914 -2.20914 -4 0 -4Z" fill="#E11D48" />
      </g>
    </svg>
  );
}
