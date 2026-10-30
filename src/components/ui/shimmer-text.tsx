"use client";
import { motion } from "motion/react";
import React, { type JSX, useMemo } from "react";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

function TextShimmerComponent({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements
  );

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  return (
    <MotionComponent
      initial={{ backgroundPosition: "100% 50%" }}
      animate={{ backgroundPosition: ["100% 50%", "0% 50%"] }}
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: "linear",
      }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text",
        "text-transparent",
        "[--base-color:#a1a1aa] [--base-gradient-color:#000000]",
        className
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "linear-gradient(90deg, transparent calc(50% - var(--spread)), var(--base-gradient-color, #000000), transparent calc(50% + var(--spread))), linear-gradient(var(--base-color, #a1a1aa), var(--base-color, #a1a1aa))",
          backgroundRepeat: "no-repeat, padding-box",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        } as React.CSSProperties
      }
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
