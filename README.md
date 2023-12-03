# Real-time Live Stream with Adaptive ML inference

This project is a demo of a real-time live stream with ML inference. It is built on top of paddle.js and WebRTC. It is a part of the final project for CS6235 at Georgia Tech.

First off, for course staff, please find our final report and presentation in [this directory](./final-report-materials).

## Getting Started
We have two demos, one for adaptive model switching and one for video chat. To setup and run the demo, go to the corresponding directory and follow the instructions in the README.md file.

## Demo
The adaptive model switching demo is currently hosted at [https://cs6235-project.vercel.app/](https://cs6235-project.vercel.app/). You need to allow the browser to access your camera feed for the model to load. After the model loads successfully, you should click on "start camera" to start the video feed with the background removed. You will notice that the model will automatically switch to a smaller model if the FPS drops below a certain threshold. Beyond that, the application will also automatically switch back to a larger model if it is confident that the FPS will be high enough.

![large-model](./assets/large-model.png)
**Figure 1: Large Model, FPS is low**

![small-model](./assets/small-model.png)
**Figure 2: automatically switched to Small Model, FPS is high, sacrificing accuracy**

The video chat demo is currently not publicly hosted. To run the demo, you need to run the client and the server locally. After starting the client and the server, you can go to `localhost:3000` in your browser. You need to allow the browser to access your camera feed for the model to load. After the model loads successfully, you should be able to see your background removed video feed on the left hand side. You can also see the video feed of other users on the right hand side. Currently, the right hand side is still waiting for connection from other users.

You can open another browser window and go to `localhost:3000` to "call" yourself in the other window. Now, going back to the first window, you should be able to see the video feed of the second window on the right hand side. You can also see the video feed of the first window on the second window.

You will notice that the model will automatically switch to a smaller model if the FPS drops below a certain threshold. Beyond that, the application will also automatically switch back to a larger model if it is confident that the FPS will be high enough.

![waiting-for-connection](./assets/waiting-for-connection.png)

**Figure 1: Waiting for connection**

![connected](./assets/connected.png)

**Figure 2: Connected**

## Authors
- [Huan Xu](github.com/hxu296)
- [Gabriel Lopez](https://github.com/gabriellopez23)
