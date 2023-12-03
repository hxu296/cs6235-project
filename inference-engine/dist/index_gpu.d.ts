interface LoadOptions {
    needPreheat?: boolean;
    modelType?: string;
    canvasWidth?: number;
    canvasHeight?: number;
}
export declare function swapModel(options?: LoadOptions): Promise<void>;
export declare function load(options?: LoadOptions): Promise<void>;
export declare function preheat(): Promise<any>;
export declare function drawHumanSeg(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, canvas: HTMLCanvasElement, back?: HTMLCanvasElement): Promise<void>;
export declare function blurBackground(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, canvas: HTMLCanvasElement): Promise<void>;
export declare function drawMask(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, canvas: HTMLCanvasElement, back: HTMLCanvasElement): Promise<void>;
export {};
//# sourceMappingURL=index_gpu.d.ts.map