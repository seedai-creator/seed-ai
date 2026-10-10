"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PaymentConfirmation({ message, refreshLabel }: { message: string; refreshLabel: string }) {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return <div role="status"><p>{message}</p><button type="button" className="text-button" onClick={() => router.refresh()}>{refreshLabel}</button></div>;
}
