# Inference Engine

There is no demo for the inference engine, but it is used in both `buzzstream-demo-adaptive` and `buzzstream-demo-video-chat` to run background removal via human segmentation. It is seperated from the demos for ease of code review.

The `index_gpu.ts` file is the entry point for the inference engine. It is responsible for loading the model, running human segmentation, and hot-swapping models. There are 3 different models that can be loaded: `humanseg_398x224_fuse_activation` (large), `humansegv2-base` (medium), and `humanseg_288x160_fuse_activation` (small). The user can spesicy which model to load by passing in an Options JSON as follows. The model will be automatically pulled from Paddle's Model Zoo.

```ts
interface LoadOptions {
    needPreheat?: boolean,
    modelType?: string,
    canvasWidth?: number,
    canvasHeight?: number
}
```

Some of the key APIs are listed below:

```ts
// Load the model
await engine.load(options: LoadOptions);

// Swap the model
await engine.swapModel(options: LoadOptions);

// Run background removal
await engine.drawHumanSeg(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement,
    background?: HTMLCanvasElement
)
```

Under the hood, inference engine is accelerated by WebGL, and it leverage paddle.js to run inference. The `customOp` and `customTransformer` are implemented to accomodate model loading by handling the custom operators layers in the pretrained model. In addition, inference engine also depends on a third party WebGL library called `webgl-image-filter` for basic image processing util functions, which can be found in the `thirdParty` directory.