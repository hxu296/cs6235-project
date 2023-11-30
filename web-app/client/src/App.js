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

const hiddenVideo = {
  position: "fixed",
  top: 0,
  left: 0,
  width: 640,
  height: 480,
  transform: "translate(-100%, -100%);", // Moves the video out of the viewport
  PointerEvents: 'none',
  visibility: 'hidden',
};


const StyledButton = styled.button`
  display: inline-block;
  background-color: ${props => props.accept ? '#008000' : '#007BFF'};
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.3s;
  &:hover {
    background-color: ${props => props.accept ? '#006400' : '#0056b3'};
  }
`;

const VideoContainer = styled.div`
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid #ddd;
  margin-bottom: 20px;
  margin-left: 1vw;
  margin-right: 1vw;
`;

const VideoLabel = styled.div`
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
`;

const videoStyle = {
  width: '640px',
  height: '480px',
  backgroundColor: 'black',
};

const informationCardStyle = {
  marginLeft: '1vw',
  marginTop: '2vh',
  width: '28vw',
  height: '15vh',
  backgroundColor: '#f2f2f2',
  borderRadius: '5px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  border: '2px solid #ddd',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '10px',
  zIndex: 2,
};

const VideoPlaceholder = styled.div`
  width: 640px;
  height: 480px;
  background-color: #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-size: 24px;
  border: 2px solid #ddd;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;


function App() {
  const [yourID, setYourID] = useState("");
  const [users, setUsers] = useState({});
  const [stream, setStream] = useState();
  const [processedStream, setProcessedStream] = useState();
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
  const userProcessedVideoRef = useRef();

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
    // if url param has ?id=xxx
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id !== undefined && id !== null && id !== "") {
      socket.current = io.connect("/", { query: `id=${id}` });
    } else {
      socket.current = io.connect("/");
    }
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

  // capture processed video stream from canvas
  useEffect(() => {
    let processedStream;
    if (userStreamCanvasRef.current) {
      processedStream = userStreamCanvasRef.current.captureStream();
      setProcessedStream(processedStream);
    }
    if (userProcessedVideoRef.current) {
      userProcessedVideoRef.current.srcObject = processedStream;
    }
  }, [userStreamCanvasRef]);

  // Update FPS and handle model switching
  const updateFPS = () => {
    frameCount++;
    const now = Date.now();
    const duration = now - lastFrameTime;

    if (duration > 1000) {
      fps = Math.round((frameCount * 1000) / duration);
      if(modelType === 'small' ) {
        // DEBUG ONLY: artificially increase FPS for small model
        fps += 10;
      }
      document.getElementById('fps').innerHTML = `FPS: ${fps}`;
      // change color of FPS based on threshold
      if (fps < SWITCH_MODEL_FPS_THRESHOLD) {
        document.getElementById('fps').style.color = 'red';
      } else {
        document.getElementById('fps').style.color = 'green';
      }

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
      stream: processedStream,
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
      stream: processedStream,
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
  let incomingCall;

  if (callAccepted) {
    PartnerVideo = (
      <VideoContainer style={{ marginLeft: '7vw' }}>
        <VideoLabel>Peer's Video</VideoLabel>
        <video style={videoStyle} playsInline ref={partnerVideo} autoPlay />
      </VideoContainer>
    );
  } else {
    PartnerVideo = (
      <VideoPlaceholder style={{ marginLeft: '7vw' }}>
        Awaiting Connection...
      </VideoPlaceholder>
    );
  }

  if (receivingCall) {
    incomingCall = (
      <div style={{ display: 'flex', alignItems: 'center', marginTop: "1vh"}}>
        <p style={{ marginLeft: '1vw' }}>User</p>
        <p style={{ fontWeight: 'bold', fontFamily: 'monospace', marginLeft: '10px', marginRight: '10px' }}>{caller}</p>
        <p>is calling you</p>
        <StyledButton accept onClick={acceptCall} style={{ marginLeft: '1vw' }}>
          Accept Call
        </StyledButton>
      </div>
    )
  }

  return (
    <Container>
      <Row>
        <video style={hiddenVideo} muted ref={userVideoRef} autoPlay />
        <VideoContainer>
          <VideoLabel>Your Video</VideoLabel>
          <video style={videoStyle} muted ref={userProcessedVideoRef} autoPlay />
        </VideoContainer>
        {PartnerVideo}
      </Row>
      <Row>
        {Object.keys(users).map(key => {
          if (key === yourID) {
            return null;
          }
          return (
            <StyledButton key={key} onClick={() => callPeer(key)} style={{ marginLeft: '1vw' }}>
              Call {key}
            </StyledButton>
          );
        })}
      </Row>
      <Row>
        {incomingCall}
      </Row>
      <div style={informationCardStyle}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '1vw' }}>Your ID: {yourID}</div>
        <div id='fps' style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '1vw' }}>FPS: {fps}</div>
        <div id='model-type' style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '1vw' }}>Model Type: {modelType.toUpperCase()}</div>
        <div id='confidence' style={{ fontSize: '20px', fontWeight: 'bold', marginLeft: '1vw' }}>Confidence: {confidence.toFixed(2)}</div>
      </div>
      <canvas ref={backgroundCanvasRef} width="700" height="480" style={{ display: 'none' }} />
      <canvas ref={userStreamCanvasRef} width="640" height="480" style={{ display: 'none' }} />
    </Container>
  );
}

export default App;
