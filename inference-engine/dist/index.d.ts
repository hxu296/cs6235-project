import '@paddlejs/paddlejs-backend-webgl';
export declare function load(needPreheat?: boolean, enableLightModel?: boolean, customModel?: any): Promise<void>;
export declare function preheat(): Promise<any>;
export declare function getGrayValue(input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<{
    width: number;
    height: number;
    data: any;
}>;
export declare function drawHumanSeg(seg_values: number[], canvas: HTMLCanvasElement, backgroundCanvas?: HTMLCanvasElement | HTMLImageElement): void;
export declare function blurBackground(seg_values: number[], dest_canvas: any): void;
export declare function drawMask(seg_values: number[], dest: HTMLCanvasElement, canvas: HTMLCanvasElement): void;
//# sourceMappingURL=index.d.ts.map