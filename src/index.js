import "./styles.css";
import "./resize.js";
import * as tf from "@tensorflow/tfjs";
import * as posedetection from "@tensorflow-models/pose-detection";

let webcamElement, canvasElement, ctx, startBtn, stopBtn;
let countElement, loadingElement;

let isRunning = false;
let detector;
let jumpingJackCount = 0;
let lastPoseState = null;
let currentPoseState = null;

const minConfidence = 0.4;

async function init() {
  await tf.ready();

  webcamElement = document.getElementById("webcam");
  canvasElement = document.getElementById("canvas");
  ctx = canvasElement.getContext("2d");
  startBtn = document.getElementById("startBtn");
  stopBtn = document.getElementById("stopBtn");
  countElement = document.getElementById("count");
  loadingElement = document.getElementById("loading");

  try {
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

    setupResizeObserver();
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
    } else if (lastPoseState === "up" && currentPoseState === "down") {
      jumpingJackCount++;
      countElement.textContent = jumpingJackCount;
      document.body.style.backgroundColor = "lightgreen"; // Down state background
    }
  }
}

function drawPose(pose) {
  // Only draw the keypoints used in the jumping jack detection
  const usedKeypointIndices = [5, 6, 9, 10, 11, 12, 15, 16];
  const usedKeypointLabels = [
    "Left Shoulder",
    "Right Shoulder",
    "Left Wrist",
    "Right Wrist",
    "Left Hip",
    "Right Hip",
    "Left Ankle",
    "Right Ankle",
  ];

  usedKeypointIndices.forEach((index, i) => {
    const keypoint = pose.keypoints[index];
    const { x, y, score } = keypoint;

    if (score >= minConfidence) {
      // Draw confident keypoints in aqua
      ctx.fillStyle = "aqua";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  });

  // Draw connecting lines
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;

  drawLine(pose.keypoints[5], pose.keypoints[6]);

  // hips
  drawLine(pose.keypoints[11], pose.keypoints[12]);

  // shoulders to wrists (arms)
  drawLine(pose.keypoints[5], pose.keypoints[9]);
  drawLine(pose.keypoints[6], pose.keypoints[10]);

  // hips to ankles (legs)
  drawLine(pose.keypoints[11], pose.keypoints[15]);
  drawLine(pose.keypoints[12], pose.keypoints[16]);

  // shoulder to hip (torso)
  drawLine(pose.keypoints[5], pose.keypoints[11]);
  drawLine(pose.keypoints[6], pose.keypoints[12]);

  // Update background color based on keypoint confidence
  const usedKeypoints = usedKeypointIndices.map(
    (index) => pose.keypoints[index]
  );
  const lowConfidenceKeypoints = usedKeypoints.filter(
    ({ score }) => score < minConfidence
  );

  if (lowConfidenceKeypoints.length > 0) {
    document.body.style.backgroundColor = "lightcoral";
  } else {
    document.body.style.backgroundColor = "lightgreen";
  }
}

function drawLine(point1, point2) {
  if (point1.score >= minConfidence && point2.score >= minConfidence) {
    ctx.beginPath();
    ctx.moveTo(point1.x, point1.y);
    ctx.lineTo(point2.x, point2.y);
    ctx.stroke();
  }
}

function areKeypointsConfident(keypoints) {
  return keypoints.every(({ score }) => score >= minConfidence);
}

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

window.addEventListener("load", init);
