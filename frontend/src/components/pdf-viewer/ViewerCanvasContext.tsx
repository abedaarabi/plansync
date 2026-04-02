"use client";

import { createContext, useContext, type RefObject } from "react";

type ViewerCanvasContextValue = {
  pageCanvasRef: RefObject<HTMLCanvasElement | null>;
};

export const ViewerCanvasContext = createContext<ViewerCanvasContextValue | null>(null);

export function useViewerPageCanvasRef(): RefObject<HTMLCanvasElement | null> | null {
  return useContext(ViewerCanvasContext)?.pageCanvasRef ?? null;
}
