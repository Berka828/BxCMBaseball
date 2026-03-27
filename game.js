const startBtn = document.getElementById("startBtn");
const instructionChip = document.getElementById("instructionChip");
const video = document.getElementById("video");

startBtn.onclick = async () => {
  try {
    instructionChip.textContent = "Starting camera...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    instructionChip.textContent = "Camera started successfully.";
  } catch (err) {
    console.error(err);
    instructionChip.textContent = "Camera failed: " + err.message;
  }
};
