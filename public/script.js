document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const template = document.getElementById('file-preview-template');
    const actionButtonsContainer = document.getElementById('action-buttons');
    const convertAllBtn = document.getElementById('convert-all-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

    let filesMap = new Map();

    // --- Event Listeners ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    convertAllBtn.addEventListener('click', convertAllFiles);
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
    clearAllBtn.addEventListener('click', clearAllFiles);

    // --- Core Functions ---
    function handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const fileId = `${file.name}-${file.lastModified}`;
                if (!filesMap.has(fileId)) {
                    createFilePreview(file, fileId);
                    filesMap.set(fileId, { file, status: 'pending' });
                }
            }
        }
        updateActionButtonsVisibility();
    }

    function createFilePreview(file, fileId) {
        const clone = template.content.cloneNode(true);
        const previewItem = clone.querySelector('.file-preview-item');
        previewItem.dataset.id = fileId;

        const reader = new FileReader();
        reader.onload = () => {
            previewItem.querySelector('.thumbnail').src = reader.result;
        };
        reader.readAsDataURL(file);

        previewItem.querySelector('.file-name').textContent = file.name;
        previewItem.querySelector('.file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
        
        previewContainer.appendChild(clone);
    }

    async function convertAllFiles() {
        convertAllBtn.disabled = true;
        downloadAllBtn.style.display = 'none';

        const conversionPromises = [];
        for (const [fileId, fileData] of filesMap.entries()) {
            if (fileData.status === 'pending') {
                conversionPromises.push(convertSingleFile(fileId, fileData.file));
            }
        }
        
        await Promise.all(conversionPromises);
        
        convertAllBtn.disabled = false;
        const successfulConversions = Array.from(filesMap.values()).filter(f => f.status === 'success').length;
        if (successfulConversions > 1) {
            downloadAllBtn.style.display = 'flex';
        }
    }

    async function convertSingleFile(fileId, file) {
        const previewItem = previewContainer.querySelector(`[data-id="${fileId}"]`);
        const statusIndicator = previewItem.querySelector('.status-indicator');
        const actionArea = previewItem.querySelector('.action-area');
        
        statusIndicator.innerHTML = '<div class="spinner"></div>';
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch('/convert-single', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Server conversion failed.');
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            const fileData = filesMap.get(fileId);
            fileData.status = 'success';
            fileData.blob = blob;

            statusIndicator.innerHTML = '<svg class="status-icon success" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
            
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `${file.name.split('.').slice(0, -1).join('.')}.jpg`;
            downloadLink.className = 'download-link';
            downloadLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg><span>Download</span>`;
            
            actionArea.innerHTML = '';
            actionArea.appendChild(downloadLink);
            
        } catch (error) {
            filesMap.get(fileId).status = 'error';
            statusIndicator.innerHTML = '<svg class="status-icon error" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
        }
    }

    async function downloadAllAsZip() {
        const formData = new FormData();
        let filesToZipCount = 0;
        for (const fileData of filesMap.values()) {
            if (fileData.status === 'success') {
                formData.append('images', fileData.file, fileData.file.name);
                filesToZipCount++;
            }
        }
        if (filesToZipCount === 0) return;

        const response = await fetch('/convert-and-zip', { method: 'POST', body: formData });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted-images.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }
    
    function clearAllFiles() {
        filesMap.clear();
        previewContainer.innerHTML = '';
        updateActionButtonsVisibility();
        downloadAllBtn.style.display = 'none';
        fileInput.value = ''; // Reset file input
    }
    
    // --- Helper Functions ---
    function updateActionButtonsVisibility() {
        if (filesMap.size > 0) {
            actionButtonsContainer.style.display = 'grid';
        } else {
            actionButtonsContainer.style.display = 'none';
        }
    }
});