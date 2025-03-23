document.addEventListener("DOMContentLoaded", function () {
  const videoContainer = document.getElementById("videoContainer");
  let isDragging = false;
  let offsetX, offsetY;

  videoContainer.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", drag);
  document.addEventListener("mouseup", endDrag);

  addEventListener("touchend", handleTouchEnd);

  function startDrag(e) {
    if (e.target.id == "videoContainer") {
      return;
    }
    console.log(e.target.id);
    const resizeHandle = window.getComputedStyle(videoContainer).cursor;
    if (resizeHandle === "ew-resize") return;

    isDragging = true;
    offsetX = e.clientX - videoContainer.getBoundingClientRect().left;
    offsetY = e.clientY - videoContainer.getBoundingClientRect().top;

    videoContainer.classList.add("dragging");
  }

  function drag(e) {
    if (!isDragging) return;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    const maxX = window.innerWidth - videoContainer.offsetWidth;
    const maxY = window.innerHeight - videoContainer.offsetHeight;

    videoContainer.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    videoContainer.style.top = Math.max(0, Math.min(maxY, y)) + "px";

    videoContainer.style.bottom = "auto";
  }

  function endDrag() {
    isDragging = false;
    videoContainer.classList.remove("dragging");
  }

  // Touch event handlers
  function handleTouchStart(e) {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    startDrag(mouseEvent);
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    drag(mouseEvent);
  }

  function handleTouchEnd() {
    endDrag();
  }

  let aspectRatio = 240 / 180;
  let resizeObserver;

  function setupResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        for (let entry of entries) {
          const width = entry.contentRect.width;
          const height = width / aspectRatio;

          if (Math.abs(entry.contentRect.height - height) > 1) {
            videoContainer.style.height = height + "px";
          }
        }
      });
    });

    resizeObserver.observe(videoContainer);
  }

  videoContainer.addEventListener("mouseup", () => {
    const width = videoContainer.offsetWidth;
    videoContainer.style.height = width / aspectRatio + "px";
  });

  const initialWidth = videoContainer.offsetWidth;
  videoContainer.style.height = initialWidth / aspectRatio + "px";

  setupResizeObserver();
});
