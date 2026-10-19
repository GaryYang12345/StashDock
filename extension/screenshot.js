export function compressScreenshot(dataUrl, viewport = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = viewport.width > 0 ? Math.min(1, Math.max(.5, viewport.contentWidth / viewport.width)) : 1;
      const sourceWidth = Math.max(1, Math.floor(image.naturalWidth * ratio));
      const targetWidth = Math.min(720, sourceWidth);
      const sourceHeight = Math.min(image.naturalHeight, Math.round(sourceWidth * 0.625));
      const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        reject(new Error("Screenshot canvas is unavailable."));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(
        image,
        0,
        0,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.68));
    };
    image.onerror = () => reject(new Error("Screenshot could not be resized."));
    image.src = dataUrl;
  });
}

// Capture is resized in the worker before mounting the floating form.
export async function compressScreenshotInWorker(dataUrl, viewport = {}) {
  const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const ratio = viewport.width > 0 ? Math.min(1, Math.max(.5, viewport.contentWidth / viewport.width)) : 1;
    const sourceWidth = Math.max(1, Math.floor(image.width * ratio));
    const targetWidth = Math.min(720, sourceWidth);
    const sourceHeight = Math.min(image.height, Math.round(sourceWidth * .625));
    const targetHeight = Math.max(1, Math.round(sourceHeight / sourceWidth * targetWidth));
    const canvas = new OffscreenCanvas(targetWidth, targetHeight), context = canvas.getContext('2d', { alpha:false });
    if (!context) throw Error('Screenshot canvas is unavailable.');
    context.fillStyle = '#ffffff'; context.fillRect(0,0,targetWidth,targetHeight);
    context.drawImage(image,0,0,sourceWidth,sourceHeight,0,0,targetWidth,targetHeight);
    const bytes = new Uint8Array(await (await canvas.convertToBlob({ type:'image/jpeg', quality:.68 })).arrayBuffer());
    let binary = ''; for (let offset=0;offset<bytes.length;offset+=8192) binary += String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return 'data:image/jpeg;base64,' + btoa(binary);
  } finally { image.close(); }
}
