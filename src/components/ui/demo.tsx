"use client";

import { TextShimmer } from "@/components/ui/shimmer-text";

export function StatusLine() {
  return (
    <TextShimmer className="font-light text-base tracking-tight [--base-color:#a1a1aa] [--base-gradient-color:#000000]">
      Menyinkronkan akun Anda
    </TextShimmer>
  );
}

export default StatusLine;
