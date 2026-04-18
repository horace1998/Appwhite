import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import html2canvas from "html2canvas";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function exportAsImage(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }
  
  try {
    const canvas = await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      scale: 2 // Higher resolution
    });
    
    // Create download link
    const image = canvas.toDataURL("image/png", 1.0);
    const link = document.createElement("a");
    link.download = filename;
    link.href = image;
    link.click();
  } catch (err) {
    console.error("Export image failed", err);
  }
}

