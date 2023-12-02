/**
 * @file Core inference engine for buzzStream, encapsulate the following functionalities:
 * // 1) Load models from Paddle's model zoo
 * // 2) Preheat models
 * // 3) Run inference on input image
 * // 4) Draw inference results on canvas
 */

import { Runner, env, registerOp } from '@paddlejs/paddlejs-core';
import { GLHelper } from '@paddlejs/paddlejs-backend-webgl';
import segImg from './customOp/segImg';
import AppendDealOriginOpToNN from './customTransformer/appendCustomOpToNN';

interface LoadOptions {
    needPreheat?: boolean,
    modelType?: string,
    canvasWidth?: number,
    canvasHeight?: number
}

let runner = null as Runner;

const WIDTH = 398;
const HEIGHT = 224;

function registerCustomOp() {
    registerOp(segImg, 'segImg');
}

registerCustomOp();


const WEBGL_ATTRIBUTES = Object.assign({}, GLHelper.WEBGL_ATTRIBUTES, {
    alpha: true
});

function createWebglContext(canvas: HTMLCanvasElement) {
    let gl = canvas.getContext('webgl2', WEBGL_ATTRIBUTES) as WebGLRenderingContext | null;
    if (gl) {
        env.set('webglVersion', 2);
    }
    else {
        env.set('webglVersion', 1);
        gl = (canvas.getContext('webgl', WEBGL_ATTRIBUTES)
            || canvas.getContext('experimental-webgl', WEBGL_ATTRIBUTES)) as WebGLRenderingContext;
    }

    return gl as WebGLRenderingContext;
}

const renderCanvas = document.createElement('canvas');
renderCanvas.width = 500;
renderCanvas.height = 280;
const gl = createWebglContext(renderCanvas);

let segImgOp = null;

export async function load(options: LoadOptions = {
    needPreheat: true,
    modelType: 'large',
    canvasWidth: 500,
    canvasHeight: 280
}) {
    // Pull model from Paddle's model zoo rather than local file for reproducibility
    const largeModelpath = 'https://paddlejs.bj.bcebos.com/models/fuse/humanseg/humanseg_398x224_fuse_activation/model.json';
    const mdediumModelPath = 'https://paddlejs.cdn.bcebos.com/models/humansegv2/model.json';
    const smallModelPath = 'https://paddlejs.bj.bcebos.com/models/fuse/humanseg/humanseg_288x160_fuse_activation/model.json';
    const modelPath = options.modelType === 'large' ? largeModelpath : options.modelType === 'medium' ? mdediumModelPath : smallModelPath;


    runner = new Runner({
        modelPath: modelPath,
        needPreheat: options.needPreheat !== undefined ? options.needPreheat : true,
        feedShape: {
            fw: WIDTH,
            fh: HEIGHT
        },
        fill: '#fff',
        mean: [0.5, 0.5, 0.5],
        std: [0.5, 0.5, 0.5],
        plugins: {
            preTransforms: [new AppendDealOriginOpToNN(options.canvasWidth, options.canvasHeight)]
        }
    });

    GLHelper.setWebGLRenderingContext(gl);

    env.set('webgl_pack_channel', true);
    env.set('webgl_gpu_pipeline', true);
    env.set('webgl_force_half_float_texture', true);

    await runner.init();
}

export async function preheat() {
    return await runner.preheat();
}


/**
 * draw human seg
 * @param {HTMLImageElement | HTMLVideoElement | HTMLCanvasElement} input the input image
 * @param {HTMLCanvasElement} canvas the dest canvas draws the pixels
 * @param {HTMLCanvasElement} back background canvas
 */
export async function drawHumanSeg(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    canvas: HTMLCanvasElement,
    back?: HTMLCanvasElement
) {
    if (!segImgOp) {
        segImgOp = runner.weightMap[runner.weightMap.length - 1].opData;
    }
    segImgOp.uniform.type.value = 1;
    await runner.predict(input);
    const backgroundSize = genBackgroundSize(input);
    canvas.width = input.width;
    canvas.height = input.height;
    const destCtx = canvas.getContext('2d');
    if (back) {
        destCtx.drawImage(back, -backgroundSize.bx, -backgroundSize.by, backgroundSize.bw, backgroundSize.bh);
    }
    destCtx.drawImage(gl.canvas, -backgroundSize.bx, -backgroundSize.by, backgroundSize.bw, backgroundSize.bh);
}

/**
 * draw human seg
 * @param {HTMLImageElement | HTMLVideoElement | HTMLCanvasElement} input the input image
 * @param {HTMLCanvasElement} canvas the dest canvas draws the pixels
 */
export async function blurBackground(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    canvas: HTMLCanvasElement
) {
    if (!segImgOp) {
        segImgOp = runner.weightMap[runner.weightMap.length - 1].opData;
    }
    segImgOp.uniform.type.value = 0;
    await runner.predict(input);
    canvas.width = input.width;
    canvas.height = input.height;
    const backgroundSize = genBackgroundSize(input);
    const destCtx = canvas.getContext('2d');
    destCtx.drawImage(gl.canvas, -backgroundSize.bx, -backgroundSize.by, backgroundSize.bw, backgroundSize.bh);
}

/**
 * draw human mask
 * @param {HTMLImageElement | HTMLVideoElement | HTMLCanvasElement} input the input image
 * @param {HTMLCanvasElement} canvas the dest canvas draws the pixels
 * @param {HTMLCanvasElement} back background canvas
 */
export async function drawMask(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    canvas: HTMLCanvasElement,
    back: HTMLCanvasElement
) {
    if (!segImgOp) {
        segImgOp = runner.weightMap[runner.weightMap.length - 1].opData;
    }
    segImgOp.uniform.type.value = 2;
    await runner.predict(input);
    canvas.width = input.width;
    canvas.height = input.height;
    const backgroundSize = genBackgroundSize(input);
    const destCtx = canvas.getContext('2d');
    destCtx.drawImage(back, -backgroundSize.bx, -backgroundSize.by, backgroundSize.bw, backgroundSize.bh);
    destCtx.drawImage(gl.canvas, -backgroundSize.bx, -backgroundSize.by, backgroundSize.bw, backgroundSize.bh);
}

function genBackgroundSize(inputElement) {
    // width and height of the target canvas
    let sw = WIDTH;
    let sh = HEIGHT;
    const ratio = sw / sh;
    const inputWidth = inputElement.naturalWidth || inputElement.width;
    const inputHeight = inputElement.naturalHeight || inputElement.height;
    let x = 0;
    let y = 0;
    let bx = 0;
    let by = 0;
    let bh = inputHeight;
    let bw = inputWidth;
    const origin_ratio = inputWidth / inputHeight;
    // if target's ratio is larger than origin image's ratio, then set the height of origin image to target's height
    if (ratio / origin_ratio >= 1) {
        sw = sh * origin_ratio;
        x = Math.floor((WIDTH - sw) / 2);
        bw = bh * ratio;
        bx = Math.floor((bw - inputWidth) / 2);
    }
    // if target's ratio is smaller than origin image's ratio, then set the width of origin image to target's width
    else {
        sh = sw / origin_ratio;
        y = Math.floor((HEIGHT - sh) / 2);
        bh = bw / ratio;
        by = Math.floor((bh - inputHeight) / 2);
    }
    return {
        x,
        y,
        sw,
        sh,
        bx,
        by,
        bw,
        bh
    };
}
