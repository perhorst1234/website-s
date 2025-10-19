document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('upload-form');
  const statusEl = document.getElementById('status');
  const resultSection = document.getElementById('result');
  const downloadLink = document.getElementById('download-link');
  const curlCommandInput = document.getElementById('curl-command');
  const copyButton = document.getElementById('copy-button');
  const copyFeedback = document.getElementById('copy-feedback');
  const fileInput = document.getElementById('file-input');

  const resetResult = () => {
    resultSection.classList.add('hidden');
    downloadLink.removeAttribute('href');
    downloadLink.textContent = '';
    curlCommandInput.value = '';
    copyFeedback.textContent = '';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!fileInput.files.length) {
      statusEl.textContent = 'Kies eerst een bestand om te uploaden.';
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    statusEl.textContent = 'Bezig met uploaden...';
    resetResult();

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Onbekende fout.' }));
        throw new Error(error.error || 'Upload mislukt.');
      }

      const data = await response.json();
      const downloadUrl = new URL(data.path, window.location.origin).toString();
      const suggestedName = data.originalName || 'downloaded-file';
      const curlCommand = `curl -o "${suggestedName}" "${downloadUrl}"`;

      statusEl.textContent = 'Upload geslaagd!';
      resultSection.classList.remove('hidden');
      downloadLink.href = downloadUrl;
      downloadLink.textContent = downloadUrl;
      curlCommandInput.value = curlCommand;
    } catch (error) {
      console.error(error);
      statusEl.textContent = error.message || 'Upload mislukt.';
    }
  });

  copyButton.addEventListener('click', async () => {
    if (!curlCommandInput.value) {
      copyFeedback.textContent = 'Geen commando om te kopiëren.';
      return;
    }

    try {
      await navigator.clipboard.writeText(curlCommandInput.value);
      copyFeedback.textContent = 'Gekopieerd!';
    } catch (error) {
      console.error(error);
      copyFeedback.textContent = 'Kopiëren mislukt. Kopieer handmatig.';
    }
  });
});
