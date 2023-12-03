# BuzzSteam Adaptive Demo

This is a demo of the BuzzStream application. It will accept camera feed and remove the background from the video feed. Notably, the application will detect the current FPS and automatically switch to a smaller model if the FPS drops below a certain threshold. Beyond that, the application will also automatically switch back to a larger model if it is confident that the FPS will be high enough.

## Getting Started
To setup and run the demo, make sure you have `npm` installed. Then, run the following commands:
```bash
npm install
npm run dev
```
Then, go to `localhost:8866` in your browser.

## Demo
