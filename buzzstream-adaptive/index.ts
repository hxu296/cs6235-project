import Camera from '@paddlejs-mediapipe/camera';
import * as inferenceEngine from './inference_engine/index_gpu';


// Constants
const GRACE_PERIOD_MS = 7000; // Grace period in milliseconds to not switch models too frequently
const SWITCH_MODEL_FPS_THRESHOLD = 40; // FPS threshold to switch to a smaller model

// Extract URL parameters
const queryParams = new URLSearchParams(window.location.search);
const autostart = queryParams.get('autostart');
const modelType = queryParams.get('model') || 'large';

// Elements
const loadingDom = document.getElementById('isLoading');
const video = document.getElementById('video') as HTMLVideoElement;
const videoToolDom = document.getElementById('video-tool');
const demoCanvas = document.getElementById('demo') as HTMLCanvasElement;
const backCanvas = document.createElement('canvas') as HTMLCanvasElement;
const confidenceDom = document.getElementById('confidence');

// Background setup
const backgroundCanvas = document.createElement('canvas');
backgroundCanvas.width = backCanvas.width;
backgroundCanvas.height = backCanvas.height;

const image = new Image();
image.src = './bgImgs/gt.jpeg';
image.onload = () => {
    const ctx = backgroundCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0, backgroundCanvas.width, backgroundCanvas.height);
};

// Model type
const modelTypeDom = document.getElementById('model-type');
modelTypeDom.innerHTML = "Model Type: " + modelType.toUpperCase();

// FPS Monitoring
let lastFrameTime = Date.now();
let frameCount = 0;

// Camera Setup
let cameraStartTime = -1;
let camera = null;

// confidence for model switching
let confidence = parseFloat(queryParams.get('confidence')) || 0.5;
let step_size = parseFloat(queryParams.get('step-size')) || 0.02;

/**
 * Initializes the camera and attaches the onFrame callback
 */
function setupCamera() {
    camera = new Camera(video, {
        mirror: true,
        enableOnInactiveState: true,
        onFrame: onCameraFrame
    });

    if (autostart === 'true') {
        camera.start();
        cameraStartTime = Date.now(); // Set the camera start time.
    }
}

/**
 * Callback function to be called every frame by the camera
 */
async function onCameraFrame() {
    const videoCanvas = document.createElement('canvas');
    const videoCanvasCtx = videoCanvas.getContext('2d');

    videoCanvas.width = video.width;
    videoCanvas.height = video.height;

    if (video.paused) {
        demoCanvas.getContext('2d').drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height);
        console.log('Video is paused.');
    } else {
        videoCanvasCtx.drawImage(video, 0, 0, video.width, video.height);
        inferenceEngine.drawHumanSeg(videoCanvas, demoCanvas, backgroundCanvas);
    }

    updateFPS();
}

// Handle low FPS and model switching only after grace period
function adaptiveModelSwitching(fps) {
    // handle low FPS and model switching only after grace period
    if (cameraStartTime > 0 &&
        (Date.now() - cameraStartTime) > GRACE_PERIOD_MS && 
        fps < SWITCH_MODEL_FPS_THRESHOLD) 
    {
        confidence /= 2;
        step_size /= 2;
        console.log(step_size);
    } else if(fps >= SWITCH_MODEL_FPS_THRESHOLD) {
        // confidense is capped at 1
        confidence += step_size;
        confidence = Math.min(confidence, 1);
    }
    if (modelType !== 'small' && confidence < 0.5) {
        switchToModel('small');
    }
    // if confidence is high, switch to large model
    if (modelType !== 'large' && confidence > 0.8) {
        switchToModel('large');
    }
    // update confidence DOM
    confidenceDom.innerHTML = "Confidence: " + confidence.toFixed(2);
}

/**
 * Monitors and updates FPS in the DOM
 */
function updateFPS() {
    const fpsDisplay = document.getElementById('fps');
    if (video.paused) {
        fpsDisplay.innerHTML = "FPS: 0";
        return;
    }

    frameCount++;
    const now = Date.now();
    const duration = now - lastFrameTime;
    if (duration > 1000) {
        let fps = Math.round((frameCount * 1000) / duration);
        fpsDisplay.innerHTML = "FPS: " + fps.toString();
        // change color based on fps
        if (fps < SWITCH_MODEL_FPS_THRESHOLD) {
            fpsDisplay.style.color = 'red';
        } else if (fps < 50) {
            fpsDisplay.style.color = 'orange';
        }
        else {
            fpsDisplay.style.color = 'green';
        }
        
        // Check for FPS and model switching after grace period
        adaptiveModelSwitching(fps);

        frameCount = 0;
        lastFrameTime = now;
    }
}

/**
 * Function that switches to a different model size
 * @param {string} size - The model size to switch to.
 */
function switchToModel(size) {
    // Implementation of model switching logic
    // Update the URL parameter and reload the camera
    queryParams.set('model', size);
    queryParams.set('autostart', 'true');
    queryParams.set('confidence', confidence.toFixed(1).toString());
    queryParams.set('step-size', step_size.toString());
    window.location.search = queryParams.toString();
}

/**
 * Loads and initializes the specified model size based on URL parameters or defaults
 */
async function loadModel() {
    // Define model loading logic based on the model type
    switch (modelType) {
        case 'large':
            await inferenceEngine.load(
                {
                    needPreheat: true,
                    modelType: 'large',
                }
            );
            break;
        case 'medium':
            await inferenceEngine.load(
                {
                    needPreheat: true,
                    modelType: 'medium',
                }
            );
            break;
        case 'small':
            await inferenceEngine.load(
                {
                    needPreheat: true,
                    modelType: 'small',
                }
            );
            break;
        default:
            await inferenceEngine.load();
            break;
    }

    console.log(`Loaded model: ${modelType}`);
    setupCamera();
}

// Event Listeners
video && video.addEventListener('loadeddata', function () {
    loadingDom && loadingDom.remove();
});

videoToolDom.addEventListener('click', function (e: Event) {
    const target = e.target as HTMLElement;
    if (target.id === 'start') {
        camera.start();
        cameraStartTime = Date.now(); // Reset the camera start time.
    }
    if (target.id === 'pause') {
        camera.pause();
    }
});

loadModel(); // load the model and start the camera