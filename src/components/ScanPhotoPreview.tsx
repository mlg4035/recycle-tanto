"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";

type Props = {
  blob: Blob;
  alt: string;
  width: number;
  height: number;
  className?: string;
};

export function ScanPhotoPreview({ blob, alt, width, height, className }: Props) {
  const objectUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <Image
      src={objectUrl}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
    />
  );
}
