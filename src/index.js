import "./styles.css";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";

let webcamElement, canvasElement, ctx, startBtn, stopBtn;
let countElement, speedElement, loadingElement;

let isRunning = false;
let detector;
let jumpingJackCount = 0;
let lastPoseState = null;
let currentPoseState = null;
let firstJumpingJackTime = null; // To track the time of the first jumping jack

const minConfidence = 0.3;

async function init() {
  await tf.ready();

  webcamElement = document.getElementById("webcam");
  canvasElement = document.getElementById("canvas");
  ctx = canvasElement.getContext("2d");
  startBtn = document.getElementById("startBtn");
  stopBtn = document.getElementById("stopBtn");
  countElement = document.getElementById("count");
  speedElement = document.getElementById("speed");
  loadingElement = document.getElementById("loading");

  try {
    loadingElement.style.display = "block";

    // Initialize the pose detection model (MoveNet)
    detector = await posedetection.createDetector(
      posedetection.SupportedModels.MoveNet
    );

    startBtn.addEventListener("click", startCamera);
    stopBtn.addEventListener("click", stopDetection);

    loadingElement.style.display = "none";
  } catch (error) {
    console.error("Error initializing the app:", error);
    document.body.style.backgroundColor = "lightcoral"; // Error background
    loadingElement.style.display = "none";
  }
}

async function startCamera() {
  try {
    webcamElement.width = 640;
    webcamElement.height = 480;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    webcamElement.srcObject = stream;

    await new Promise((resolve) => (webcamElement.onloadedmetadata = resolve));

    canvasElement.width = webcamElement.width;
    canvasElement.height = webcamElement.height;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    document.body.style.backgroundColor = "lightgreen"; // Ready background

    isRunning = true;
    detectPose(); // Start detecting poses
  } catch (error) {
    console.error("Error starting camera:", error);
    document.body.style.backgroundColor = "lightcoral"; // Error background
  }
}

function stopDetection() {
  isRunning = false;

  if (webcamElement.srcObject) {
    webcamElement.srcObject.getTracks().forEach((track) => track.stop());
    webcamElement.srcObject = null;
  }

  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  startBtn.disabled = false;
  stopBtn.disabled = true;
  document.body.style.backgroundColor = ""; // Reset background
}

async function detectPose() {
  if (!isRunning) return;

  try {
    const poses = await detector.estimatePoses(webcamElement);

    if (poses.length > 0) {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      detectJumpingJack(poses[0]); // Analyze the pose
      drawPose(poses[0]); // Draw keypoints
    }

    requestAnimationFrame(detectPose);
  } catch (error) {
    console.error("Error detecting pose:", error);
    isRunning = false;
  }
}

function detectJumpingJack(pose) {
  const keypoints = pose.keypoints;

  // Extract key body parts
  const leftShoulder = keypoints[5];
  const rightShoulder = keypoints[6];
  const leftHip = keypoints[11];
  const rightHip = keypoints[12];
  const leftWrist = keypoints[9];
  const rightWrist = keypoints[10];
  const leftAnkle = keypoints[15];
  const rightAnkle = keypoints[16];

  // Ensure all keypoints are detected confidently
  if (
    !areKeypointsConfident([
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftWrist,
      rightWrist,
      leftAnkle,
      rightAnkle,
    ])
  ) {
    document.body.style.backgroundColor = "lightcoral"; // Error background
    return;
  }

  // Calculate ratios to determine jumping jack state
  const hipWidth = distance(leftHip, rightHip);
  const ankleWidth = distance(leftAnkle, rightAnkle);
  const legRatio = ankleWidth / hipWidth;

  const shoulderHeight = (leftShoulder.y + rightShoulder.y) / 2;
  const wristHeight = (leftWrist.y + rightWrist.y) / 2;
  const armsUp = wristHeight < shoulderHeight;

  let newState = null;
  if (armsUp && legRatio > 1.5) newState = "up"; // Arms up, legs apart
  else if (!armsUp && legRatio < 1.2) newState = "down"; // Arms down, legs together

  // Detect transition from down to up and count the jumping jack
  if (newState !== currentPoseState && newState !== null) {
    lastPoseState = currentPoseState;
    currentPoseState = newState;

    if (lastPoseState === "down" && currentPoseState === "up") {
      document.body.style.backgroundColor = "lightgreen"; // Up state background
      if (jumpingJackCount === 0) {
        firstJumpingJackTime = Date.now(); // Record the time of the first jumping jack
      }
    } else if (lastPoseState === "up" && currentPoseState === "down") {
      jumpingJackCount++;
      countElement.textContent = jumpingJackCount;
      updateSpeedDisplay();
      document.body.style.backgroundColor = "lightgreen"; // Down state background
    }
  }
}

function updateSpeedDisplay() {
  if (jumpingJackCount === 0) return; // Avoid division by zero
  const currentTime = Date.now();
  const elapsedTime = currentTime - firstJumpingJackTime; // Time since the first jumping jack
  const avgTime = elapsedTime / jumpingJackCount; // Average time per jumping jack
  speedElement.textContent = Math.round(1000 / avgTime); // Speed in jumps per second
}

function drawPose(pose) {
  ctx.fillStyle = "aqua";
  pose.keypoints.forEach(({ x, y, score }) => {
    if (score >= minConfidence) {
      // Draw confident keypoints in aqua
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // Draw low-confidence keypoints in red
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "aqua"; // Reset color for next keypoints
    }
  });

  // Check if any keypoints are below the confidence threshold
  const lowConfidenceKeypoints = pose.keypoints.filter(
    ({ score }) => score < minConfidence
  );

  if (lowConfidenceKeypoints.length > 0) {
    document.body.style.backgroundColor = "lightcoral"; // Error background
  } else {
    document.body.style.backgroundColor = "lightgreen"; // Success background
  }
}

function areKeypointsConfident(keypoints) {
  return keypoints.every(({ score }) => score >= minConfidence);
}

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

window.addEventListener("load", init);
