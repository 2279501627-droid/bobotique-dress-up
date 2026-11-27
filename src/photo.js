// Snapshot the current WebGL frame synchronously. No preserveDrawingBuffer,
// extra render loop, camera permissions or server upload is needed.
export function setupPhoto({ renderer, scene, camera, controls }) {
  const button = document.querySelector('#photo');
  const dialog = document.querySelector('#photo-dialog');
  const preview = document.querySelector('#photo-preview');
  const message = document.querySelector('#photo-message');
  const download = document.querySelector('#photo-download');
  const share = document.querySelector('#photo-share');
  let url, file, sequence = 0, ready = false, wasAuto = false;

  function release() {
    if (url) URL.revokeObjectURL(url);
    url = null;
    file = null;
    preview.removeAttribute('src');
    download.removeAttribute('href');
    preview.hidden = download.hidden = share.hidden = true;
  }
  dialog.addEventListener('close', () => {
    sequence++;
    release();
    controls.enabled = true;
    controls.autoRotate = wasAuto;
    button.disabled = !ready;
    button.focus();
  });
  document.querySelector('#photo-close').onclick = () => dialog.close();
  button.onclick = () => {
    if (!ready || dialog.open) return;
    const capture = ++sequence;
    button.disabled = true;
    wasAuto = controls.autoRotate;
    controls.autoRotate = false;
    controls.enabled = false;
    release();
    message.textContent = 'Creating your photo...';
    dialog.showModal();
    try {
      renderer.render(scene, camera);
      const canvas = document.createElement('canvas');
      canvas.width = renderer.domElement.width;
      canvas.height = renderer.domElement.height;
      canvas.getContext('2d').drawImage(renderer.domElement, 0, 0);
      canvas.toBlob(blob => {
        canvas.width = canvas.height = 1;
        if (capture !== sequence || !dialog.open) return;
        if (!blob) {
          message.textContent = 'Could not create your photo. Go back and try again.';
          return;
        }
        const name = `BOBOTIQUE-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        file = new File([blob], name, { type: 'image/png' });
        url = URL.createObjectURL(blob);
        preview.src = url;
        preview.hidden = false;
        download.href = url;
        download.download = name;
        download.hidden = false;
        share.hidden = !(navigator.share && navigator.canShare?.({ files: [file] }));
        message.textContent = 'Your photo is ready, with your current angle and zoom.';
      }, 'image/png');
    } catch (error) {
      message.textContent = 'Could not create your photo. Go back and try again.';
      console.error('Photo capture failed', error);
    }
  };
  share.onclick = async () => {
    if (!file) return;
    share.disabled = true;
    try {
      // A separate tap keeps the user activation required by iPhone Safari.
      await navigator.share({ files: [file], title: 'BOBOTIQUE' });
    } catch (error) {
      if (error.name !== 'AbortError') message.textContent = '分享暂不可用，请DOWNLOAD PNG 或长按照片保存。';
    } finally {
      share.disabled = false;
    }
  };
  return {
    get open() { return dialog.open; },
    setReady(value) { ready = value; button.disabled = !value || dialog.open; },
  };
}
