import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import Camera from '@paddlejs-mediapipe/camera';
import * as humanseg from '@paddlejs-models/humanseg/lib/index_gpu';
import backgroundImage from './gt.jpeg';

const Container = styled.div`
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  width: 100%;
`;

const Canvas = styled.canvas`
  border: 1px solid blue;
  width: 50%;
  height: 50%;
`;

function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const backgroundCanvasRef = useRef();
  const userVideoRef = useRef();
  const userStreamCanvasRef = useRef();
  const partnerVideo = useRef();
  const socket = useRef();
  const camera = useRef();

  // Function to switch models based on FPS
  let lastFrameTime = Date.now(); // Time of the last frame for FPS calculation
  let frameCount = 0; // Counter for the number of frames
  let modelType = 'large'; // Initial model type
  let fps = 0; // Initial FPS
  let confidence = 0.5; // Initial confidence
  let stepSize = 0.02; // Initial step size
  const SWITCH_MODEL_FPS_THRESHOLD = 30; // FPS threshold to switch to a smaller model
  const GRACE_PERIOD_MS = 7000; // Grace period in milliseconds to not switch models too frequently
  let cameraStartTime = Date.now(); // Set the initial camera start time

  useEffect(() => {
    socket.current = io.connect("/");
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      setStream(stream);
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
    })

    socket.current.on("yourID", (id) => {
      setYourID(id);
    })
    socket.current.on("allUsers", (users) => {
      setUsers(users);
    })
    socket.current.on("hey", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    })
    humanseg.load().then(() => {
      console.log('humanseg model loaded');
    });
  }, []);


  // Update FPS and handle model switching
  const updateFPS = () => {
    frameCount++;
    const now = Date.now();
    const duration = now - lastFrameTime;

    if (duration > 1000) {
      fps = Math.round((frameCount * 1000) / duration);
      if(modelType === 'small' ) {
        // DEBUG ONLY: artificially increase FPS for small model
        fps += 20;
      }
      document.getElementById('fps').innerHTML = `FPS: ${fps}`;

      // call adaptive model switching
      adaptiveModelSwitching(fps);

      frameCount = 0;
      lastFrameTime = now;
    }
  };

  const adaptiveModelSwitching = (currentFps) => {
    const timeSinceStart = Date.now() - cameraStartTime;

    if (timeSinceStart > GRACE_PERIOD_MS) {
      if (currentFps < SWITCH_MODEL_FPS_THRESHOLD) {
        confidence /= 2;
        stepSize /= 2;
        document.getElementById('confidence').innerHTML = `Confidence: ${confidence.toFixed(2)}`;
      } else {
        confidence += stepSize;
        confidence = Math.min(confidence, 1);
        document.getElementById('confidence').innerHTML = `Confidence: ${confidence.toFixed(2)}`;
      }
    }

    if (modelType !== 'small' && confidence < 0.5) {
      switchToModel('small');
    }

    if (modelType !== 'large' && confidence > 0.8) {
      switchToModel('large');
    }
  };

  const switchToModel = (size) => {
    // Artificially adjust the model type (this might involve re-loading models etc.)
    modelType = size;
    document.getElementById('model-type').innerHTML = `Model Type: ${modelType.toUpperCase()}`;
    // In a real scenario, you would need to replace the model loading logic
    // to suit your application's architecture, possibly involving state updates
    // and clean-up of existing resources
  };


  function callPeer(id) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });

    peer.on("signal", data => {
      socket.current.emit("callUser", { userToCall: id, signalData: data, from: yourID })
    })

    peer.on("stream", stream => {
      if (partnerVideo.current) {
        partnerVideo.current.srcObject = stream;
      }
    });

    socket.current.on("callAccepted", signal => {
      setCallAccepted(true);
      peer.signal(signal);
    })

  }

  function acceptCall() {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
    peer.on("signal", data => {
      socket.current.emit("acceptCall", { signal: data, to: caller })
    })

    peer.on("stream", stream => {
      partnerVideo.current.srcObject = stream;
    });

    console.log(callerSignal);
    peer.signal(callerSignal);
  }

  // Use a canvas to stream the processed video
  if (stream) {
    // Initialize camera using Paddle.js and assign backgroundCanvas for the human segmentation
    // Set up the background image for segmentation
    const ctx = backgroundCanvasRef.current.getContext('2d');
    const image = new Image();
    image.src = backgroundImage;
    image.onload = () => {
      ctx.drawImage(image, 0, 0, backgroundCanvasRef.current.width, backgroundCanvasRef.current.height);
    }
    console.log('background image loaded');

    camera.current = new Camera(userVideoRef.current, {
      onFrame: async () => {
        if (backgroundCanvasRef.current && userStreamCanvasRef.current) {
          humanseg.drawHumanSeg(userVideoRef.current, userStreamCanvasRef.current, backgroundCanvasRef.current);
        }
        updateFPS();
        //console.log('drawing human seg');
      },
    });
    camera.current.start();
    console.log('camera started');
  }


  let PartnerVideo;
  if (callAccepted) {
    PartnerVideo = (
      <video playsInline ref={partnerVideo} autoPlay />
    );
  }

  let incomingCall;
  if (receivingCall) {
    incomingCall = (
      <div>
        <h1>{caller} is calling you</h1>
        <button onClick={acceptCall}>Accept</button>
      </div>
    )
  }

  return (
    <Container>
      <Row>
        <video width="640" height="480" muted ref={userVideoRef} autoPlay />
        <canvas ref={userStreamCanvasRef} width="640" height="480" />
        {PartnerVideo}
      </Row>
      <div>
        <div id='fps'>FPS: 0</div>
        <div id='model-type'>Model Type: LARGE</div>
        <div id='confidence'>Confidence: 0.5</div>
      </div>
      <Row>
        {Object.keys(users).map(key => {
          if (key === yourID) {
            return null;
          }
          return (
            <button onClick={() => callPeer(key)}>Call {key}</button>
          );
        })}
      </Row>
      <Row>
        {incomingCall}
      </Row>
      <canvas ref={backgroundCanvasRef} width="640" height="480" style={{ display: 'none' }} />
    </Container>
  );
}

export default App;
