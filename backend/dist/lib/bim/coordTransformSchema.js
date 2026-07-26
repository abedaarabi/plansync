import { z } from "zod";
export const drawingCoordControlPointSchema = z.object({
    pdfNorm: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
    }),
    worldXZ: z.object({
        x: z.number().finite(),
        z: z.number().finite(),
    }),
});
export const drawingCoordTransformSchema = z.object({
    version: z.literal(1),
    controlPoints: z.array(drawingCoordControlPointSchema).min(2),
    scale: z.number().finite().positive(),
    rotationRad: z.number().finite(),
    translation: z.object({
        x: z.number().finite(),
        z: z.number().finite(),
    }),
    mmPerPdfUnit: z.number().finite().positive(),
    pageWidthPt: z.number().finite().positive(),
    pageHeightPt: z.number().finite().positive(),
});
export const drawingCoordTransformPutSchema = z.object({
    transform: drawingCoordTransformSchema,
    controlPoints: z.array(drawingCoordControlPointSchema).min(2).optional(),
});
