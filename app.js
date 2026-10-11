/**
 * PixelScale Pro - Client-side Batch Image Resizer
 * 100% In-Browser Memory Execution (No external server transfers)
 */

(() => {
  'use strict';

  // ==========================================
  // 1. 애플리케이션 상태 (State)
  // ==========================================
  const state = {
    items: [], // { id, file, name, originalSize, width, height, aspectRatio, originalUrl, resizedBlob, resizedUrl, targetWidth, targetHeight, resizedSize, status, outputFilename }
    mode: 'width', // 'width' | 'height' | 'longest' | 'shortest' | 'percent'
    targetValue: 1200,
    options: {
      format: 'original', // 'original' | 'image/webp' | 'image/jpeg' | 'image/png'
      quality: 0.92,
      noUpscale: false,
      prefix: 'resized_'
    },
    isProcessing: false,
    viewMode: 'grid' // 'grid' | 'list'
  };

  // 모드별 설명 및 기본 프리셋 정의
  const MODE_CONFIG = {
    width: {
      label: '목표 가로 너비 (px)',
      unit: 'px',
      desc: '가로 너비에 맞춰 세로 높이는 원본 비율 자동 유지',
      defaultValue: 1200,
      presets: [1920, 1280, 1080, 800, 600, 400]
    },
    height: {
      label: '목표 세로 높이 (px)',
      unit: 'px',
      desc: '세로 높이에 맞춰 가로 너비는 원본 비율 자동 유지',
      defaultValue: 800,
      presets: [1440, 1080, 800, 600, 400, 300]
    },
    longest: {
      label: '긴 축 기준 크기 (px)',
      unit: 'px',
      desc: '가로/세로 중 더 긴 변을 지정 크기로 맞추고 반대편은 비율 자동 계산',
      defaultValue: 1920,
      presets: [2560, 1920, 1440, 1200, 800, 500]
    },
    shortest: {
      label: '짧은 축 기준 크기 (px)',
      unit: 'px',
      desc: '가로/세로 중 더 짧은 변을 지정 크기로 맞추고 반대편은 비율 자동 계산',
      defaultValue: 800,
      presets: [1200, 1080, 800, 600, 450, 300]
    },
    percent: {
      label: '목표 배율 (%)',
      unit: '%',
      desc: '원본 해상도에 대한 백분율(%)로 가로/세로 비율을 동일하게 스케일링',
      defaultValue: 50,
      presets: [25, 50, 75, 125, 150, 200]
    }
  };

  // ==========================================
  // 2. DOM 요소 참조
  // ==========================================
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  
  const modeSelector = document.getElementById('modeSelector');
  const targetValueLabel = document.getElementById('targetValueLabel');
  const targetValueInput = document.getElementById('targetValueInput');
  const targetValueUnit = document.getElementById('targetValueUnit');
  const modeExplanation = document.getElementById('modeExplanation');
  const presetChips = document.getElementById('presetChips');

  const toggleAdvanced = document.getElementById('toggleAdvanced');
  const advancedContent = document.getElementById('advancedContent');
  const formatSelect = document.getElementById('formatSelect');
  const qualityRange = document.getElementById('qualityRange');
  const qualityValue = document.getElementById('qualityValue');
  const noUpscaleCheck = document.getElementById('noUpscaleCheck');
  const filePrefixInput = document.getElementById('filePrefixInput');

  const actionDashboard = document.getElementById('actionDashboard');
  const totalCountEl = document.getElementById('totalCount');
  const completedCountEl = document.getElementById('completedCount');
  const totalSizeEl = document.getElementById('totalSize');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const processAllBtn = document.getElementById('processAllBtn');
  const processBtnText = document.getElementById('processBtnText');
  const downloadZipBtn = document.getElementById('downloadZipBtn');

  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressStatusText = document.getElementById('progressStatusText');
  const progressPercentage = document.getElementById('progressPercentage');

  const gallerySection = document.getElementById('gallerySection');
  const imageGrid = document.getElementById('imageGrid');
  const viewCardsBtn = document.getElementById('viewCardsBtn');
  const viewListBtn = document.getElementById('viewListBtn');

  // Preview Modal DOM
  const previewModal = document.getElementById('previewModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalCloseActionBtn = document.getElementById('modalCloseActionBtn');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalFilename = document.getElementById('modalFilename');
  const modalDimensionInfo = document.getElementById('modalDimensionInfo');
  const modalOriginalImg = document.getElementById('modalOriginalImg');
  const modalResizedImg = document.getElementById('modalResizedImg');
  const modalOriginalMeta = document.getElementById('modalOriginalMeta');
  const modalResizedMeta = document.getElementById('modalResizedMeta');
  let currentModalItem = null;

  // ==========================================
  // 3. 유틸리티 함수
  // ==========================================
  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
  }

  function getBaseFilename(filename) {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? filename : filename.substring(0, idx);
  }

  // ==========================================
  // 4. 리사이즈 수치 계산 로직
  // ==========================================
  function calculateTargetDimensions(origWidth, origHeight, mode, val, noUpscale) {
    let targetW = origWidth;
    let targetH = origHeight;
    const ratio = origWidth / origHeight;
    const numVal = Math.max(1, Number(val) || 1);

    switch (mode) {
      case 'width':
        targetW = Math.round(numVal);
        targetH = Math.max(1, Math.round(targetW / ratio));
        break;

      case 'height':
        targetH = Math.round(numVal);
        targetW = Math.max(1, Math.round(targetH * ratio));
        break;

      case 'longest':
        if (origWidth >= origHeight) {
          targetW = Math.round(numVal);
          targetH = Math.max(1, Math.round(targetW / ratio));
        } else {
          targetH = Math.round(numVal);
          targetW = Math.max(1, Math.round(targetH * ratio));
        }
        break;

      case 'shortest':
        if (origWidth <= origHeight) {
          targetW = Math.round(numVal);
          targetH = Math.max(1, Math.round(targetW / ratio));
        } else {
          targetH = Math.round(numVal);
          targetW = Math.max(1, Math.round(targetH * ratio));
        }
        break;

      case 'percent':
        const scale = numVal / 100;
        targetW = Math.max(1, Math.round(origWidth * scale));
        targetH = Math.max(1, Math.round(origHeight * scale));
        break;
    }

    // 업스케일 방지 옵션
    if (noUpscale) {
      if (targetW > origWidth || targetH > origHeight) {
        targetW = origWidth;
        targetH = origHeight;
      }
    }

    return { targetW, targetH };
  }

  function updateItemsCalculatedDimensions() {
    state.items.forEach(item => {
      const { targetW, targetH } = calculateTargetDimensions(
        item.width,
        item.height,
        state.mode,
        state.targetValue,
        state.options.noUpscale
      );
      item.targetWidth = targetW;
      item.targetHeight = targetH;
      // 설정이 변경되었으므로 상태가 done이었던 것은 다시 처리할 수 있게 설정
      if (item.status === 'done') {
        item.status = 'ready';
        if (item.resizedUrl) {
          URL.revokeObjectURL(item.resizedUrl);
          item.resizedUrl = null;
          item.resizedBlob = null;
        }
      }
    });
    renderAllCards();
    updateDashboard();
  }

  // ==========================================
  // 5. 고품질 캔버스 리사이징 엔진 (Client Memory)
  // ==========================================
  async function resizeImage(item) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { targetWidth, targetHeight } = item;

          // 다단계 다운스케일링(Step-down downsampling)을 통해 최고 화질 유지
          // 0.5배 미만으로 대폭 축소할 경우 단계별 축소 적용
          let currentCanvas = document.createElement('canvas');
          let currentCtx = currentCanvas.getContext('2d');
          
          let curW = img.naturalWidth || item.width;
          let curH = img.naturalHeight || item.height;

          // 초기 캔버스
          currentCanvas.width = curW;
          currentCanvas.height = curH;
          currentCtx.imageSmoothingEnabled = true;
          currentCtx.imageSmoothingQuality = 'high';
          currentCtx.drawImage(img, 0, 0, curW, curH);

          // 2배 이상 작아지는 경우 단계적 축소
          while (curW * 0.5 > targetWidth && curH * 0.5 > targetHeight) {
            const nextW = Math.floor(curW * 0.5);
            const nextH = Math.floor(curH * 0.5);
            const nextCanvas = document.createElement('canvas');
            nextCanvas.width = nextW;
            nextCanvas.height = nextH;
            const nextCtx = nextCanvas.getContext('2d');
            nextCtx.imageSmoothingEnabled = true;
            nextCtx.imageSmoothingQuality = 'high';
            nextCtx.drawImage(currentCanvas, 0, 0, nextW, nextH);

            currentCanvas = nextCanvas;
            currentCtx = nextCtx;
            curW = nextW;
            curH = nextH;
          }

          // 최종 타겟 크기로 렌더링
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = targetWidth;
          finalCanvas.height = targetHeight;
          const finalCtx = finalCanvas.getContext('2d');
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = 'high';

          // 투명도가 있는 PNG/WebP 대응 또는 JPEG 배경 처리
          let outputMime = state.options.format;
          if (outputMime === 'original') {
            outputMime = item.file.type || 'image/jpeg';
            if (!outputMime.startsWith('image/')) outputMime = 'image/jpeg';
          }

          // 만약 JPEG인데 원본이 투명 배경일 경우 흰 배경 채우기
          if (outputMime === 'image/jpeg') {
            finalCtx.fillStyle = '#ffffff';
            finalCtx.fillRect(0, 0, targetWidth, targetHeight);
          }

          finalCtx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, targetWidth, targetHeight);

          // Blob 생성
          finalCanvas.toBlob(blob => {
            if (!blob) {
              reject(new Error('Canvas blob 생성 실패'));
              return;
            }

            // 이전 리사이즈 URL 정리
            if (item.resizedUrl) {
              URL.revokeObjectURL(item.resizedUrl);
            }

            item.resizedBlob = blob;
            item.resizedUrl = URL.createObjectURL(blob);
            item.resizedSize = blob.size;
            item.status = 'done';

            // 출력 파일명 구성
            const baseName = getBaseFilename(item.name);
            let ext = getFileExtension(item.name);
            if (outputMime === 'image/webp') ext = 'webp';
            else if (outputMime === 'image/jpeg') ext = 'jpg';
            else if (outputMime === 'image/png') ext = 'png';

            item.outputFilename = `${state.options.prefix}${baseName}.${ext}`;
            resolve(item);
          }, outputMime, state.options.quality);

        } catch (err) {
          reject(err);
        }
      };

      img.onerror = (e) => reject(new Error('이미지 로드 중 오류 발생'));
      img.src = item.originalUrl;
    });
  }

  // ==========================================
  // 6. 파일 추가 & 파싱
  // ==========================================
  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name));
    if (validFiles.length === 0) {
      alert('유효한 이미지 파일이 없습니다.');
      return;
    }

    for (const file of validFiles) {
      const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const originalUrl = URL.createObjectURL(file);

      // 이미지 해상도 읽기
      const dimensions = await getImageDimensions(originalUrl).catch(() => ({ width: 800, height: 600 }));
      const { targetW, targetH } = calculateTargetDimensions(
        dimensions.width,
        dimensions.height,
        state.mode,
        state.targetValue,
        state.options.noUpscale
      );

      const newItem = {
        id,
        file,
        name: file.name,
        originalSize: file.size,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.width / dimensions.height,
        originalUrl,
        resizedBlob: null,
        resizedUrl: null,
        targetWidth: targetW,
        targetHeight: targetH,
        resizedSize: 0,
        status: 'ready',
        outputFilename: `${state.options.prefix}${file.name}`
      };

      state.items.push(newItem);
    }

    renderAllCards();
    updateDashboard();

    // 사용자가 첫 업로드 시 바로 자동 처리 또는 가이드
    if (state.items.length > 0) {
      actionDashboard.classList.remove('hidden');
      gallerySection.classList.remove('hidden');
    }
  }

  function getImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  }

  // ==========================================
  // 7. 일괄 리사이징 실행 로직
  // ==========================================
  async function processAllImages() {
    if (state.isProcessing || state.items.length === 0) return;

    state.isProcessing = true;
    processAllBtn.disabled = true;
    downloadZipBtn.disabled = true;
    processBtnText.textContent = '처리 중...';
    progressContainer.classList.remove('hidden');

    const total = state.items.length;
    let completed = 0;

    for (let i = 0; i < total; i++) {
      const item = state.items[i];
      item.status = 'processing';
      updateCardStatus(item);

      // 진행률 UI 갱신
      const percent = Math.round((i / total) * 100);
      progressBarFill.style.width = `${percent}%`;
      progressPercentage.textContent = `${percent}%`;
      progressStatusText.textContent = `리사이징 중... (${i + 1}/${total}) - ${item.name}`;

      try {
        await resizeImage(item);
      } catch (err) {
        console.error('Resize Error for:', item.name, err);
        item.status = 'error';
      }

      completed++;
      updateCardStatus(item);
    }

    // 완료 상태
    progressBarFill.style.width = '100%';
    progressPercentage.textContent = '100%';
    progressStatusText.textContent = `모든 리사이징 완료! (${completed}/${total})`;

    state.isProcessing = false;
    processAllBtn.disabled = false;
    processBtnText.textContent = '다시 일괄 리사이징';
    downloadZipBtn.disabled = false;
    updateDashboard();

    setTimeout(() => {
      progressContainer.classList.add('hidden');
    }, 2500);
  }

  // ==========================================
  // 8. 개별 및 일괄 다운로드
  // ==========================================
  function downloadSingleImage(item) {
    if (!item.resizedUrl) {
      alert('먼저 리사이징을 완료해주세요.');
      return;
    }
    const a = document.createElement('a');
    a.href = item.resizedUrl;
    a.download = item.outputFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function downloadAllZip() {
    if (state.items.length === 0) return;

    // 만약 리사이징되지 않은 이미지가 있다면 먼저 일괄 처리
    const uncompleted = state.items.filter(item => item.status !== 'done');
    if (uncompleted.length > 0) {
      await processAllImages();
    }

    if (typeof JSZip === 'undefined') {
      alert('JSZip 라이브러리를 찾을 수 없습니다.');
      return;
    }

    downloadZipBtn.disabled = true;
    const originalText = downloadZipBtn.innerHTML;
    downloadZipBtn.innerHTML = `
      <svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      <span>ZIP 압축 생성 중...</span>
    `;

    try {
      const zip = new JSZip();
      const usedNames = new Set();

      state.items.forEach(item => {
        if (item.resizedBlob) {
          let filename = item.outputFilename;
          // 중복 파일명 방지
          if (usedNames.has(filename)) {
            const base = getBaseFilename(filename);
            const ext = getFileExtension(filename);
            let counter = 1;
            while (usedNames.has(`${base}_${counter}.${ext}`)) {
              counter++;
            }
            filename = `${base}_${counter}.${ext}`;
          }
          usedNames.add(filename);
          zip.file(filename, item.resizedBlob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        progressStatusText.textContent = `ZIP 압축 진행: ${metadata.percent.toFixed(0)}%`;
      });

      // ZIP 파일 다운로드 트리거
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `pixelscale_resized_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
    } catch (err) {
      console.error('ZIP 생성 오류:', err);
      alert('ZIP 파일 생성 중 오류가 발생했습니다: ' + err.message);
    } finally {
      downloadZipBtn.disabled = false;
      downloadZipBtn.innerHTML = originalText;
    }
  }

  // ==========================================
  // 9. UI 렌더링 & 갱신
  // ==========================================
  function updateDashboard() {
    const total = state.items.length;
    const completed = state.items.filter(i => i.status === 'done').length;
    const totalBytes = state.items.reduce((acc, curr) => acc + (curr.resizedSize || curr.originalSize), 0);

    totalCountEl.textContent = total;
    completedCountEl.textContent = completed;
    totalSizeEl.textContent = formatBytes(totalBytes);

    if (total === 0) {
      actionDashboard.classList.add('hidden');
      gallerySection.classList.add('hidden');
    } else {
      actionDashboard.classList.remove('hidden');
      gallerySection.classList.remove('hidden');
    }

    downloadZipBtn.disabled = completed === 0;
  }

  function renderAllCards() {
    imageGrid.innerHTML = '';
    state.items.forEach(item => {
      const card = createCardElement(item);
      imageGrid.appendChild(card);
    });
  }

  function createCardElement(item) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.id = `card_${item.id}`;

    const statusMap = {
      ready: { label: '대기 중', class: 'ready' },
      processing: { label: '처리 중...', class: 'processing' },
      done: { label: '완료', class: 'done' },
      error: { label: '실패', class: 'error' }
    };
    const curStatus = statusMap[item.status] || statusMap.ready;

    card.innerHTML = `
      <div class="card-thumb-wrap" data-id="${item.id}">
        <img class="card-thumb" src="${item.resizedUrl || item.originalUrl}" alt="${item.name}" loading="lazy">
        <span class="status-badge ${curStatus.class}">${curStatus.label}</span>
        <div class="thumb-overlay">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <span>클릭하여 비교 보기</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <div class="card-filename" title="${item.name}">${item.name}</div>
          <button type="button" class="btn-remove-item" data-id="${item.id}" title="제거">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="card-specs">
          <div class="spec-row">
            <span>원본 규격</span>
            <span class="spec-val">${item.width} &times; ${item.height} (${formatBytes(item.originalSize)})</span>
          </div>
          <div class="spec-row target">
            <span>목표 규격</span>
            <span class="spec-val">${item.targetWidth} &times; ${item.targetHeight} ${item.resizedSize ? '(' + formatBytes(item.resizedSize) + ')' : ''}</span>
          </div>
        </div>
        <div class="card-footer">
          <button type="button" class="btn btn-outline btn-sm btn-card-download" data-id="${item.id}" ${item.status === 'done' ? '' : 'disabled'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>개별 다운로드</span>
          </button>
        </div>
      </div>
    `;

    // 썸네일 클릭 시 비교 모달
    card.querySelector('.card-thumb-wrap').addEventListener('click', () => openPreviewModal(item));

    // 개별 삭제 버튼
    card.querySelector('.btn-remove-item').addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(item.id);
    });

    // 개별 다운로드 버튼
    const dlBtn = card.querySelector('.btn-card-download');
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleImage(item);
    });

    return card;
  }

  function updateCardStatus(item) {
    const card = document.getElementById(`card_${item.id}`);
    if (!card) return;

    const statusBadge = card.querySelector('.status-badge');
    const thumbImg = card.querySelector('.card-thumb');
    const dlBtn = card.querySelector('.btn-card-download');
    const targetSpecVal = card.querySelector('.spec-row.target .spec-val');

    const statusMap = {
      ready: { label: '대기 중', class: 'ready' },
      processing: { label: '처리 중...', class: 'processing' },
      done: { label: '완료', class: 'done' },
      error: { label: '실패', class: 'error' }
    };
    const curStatus = statusMap[item.status] || statusMap.ready;

    statusBadge.className = `status-badge ${curStatus.class}`;
    statusBadge.textContent = curStatus.label;

    if (item.resizedUrl) {
      thumbImg.src = item.resizedUrl;
    }

    if (item.status === 'done') {
      dlBtn.disabled = false;
      targetSpecVal.textContent = `${item.targetWidth} × ${item.targetHeight} (${formatBytes(item.resizedSize)})`;
    } else {
      dlBtn.disabled = true;
      targetSpecVal.textContent = `${item.targetWidth} × ${item.targetHeight}`;
    }
  }

  function removeItem(id) {
    const idx = state.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = state.items[idx];
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item.resizedUrl) URL.revokeObjectURL(item.resizedUrl);
      state.items.splice(idx, 1);
      const card = document.getElementById(`card_${id}`);
      if (card) card.remove();
      updateDashboard();
    }
  }

  function clearAllItems() {
    if (state.items.length === 0) return;
    if (!confirm('목록의 모든 이미지를 지우시겠습니까?')) return;

    state.items.forEach(item => {
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      if (item.resizedUrl) URL.revokeObjectURL(item.resizedUrl);
    });
    state.items = [];
    imageGrid.innerHTML = '';
    updateDashboard();
  }

  // ==========================================
  // 10. 모드 및 프리셋 설정 UI 바인딩
  // ==========================================
  function updateModeUI(modeKey) {
    const config = MODE_CONFIG[modeKey];
    if (!config) return;

    state.mode = modeKey;
    targetValueLabel.querySelector('.label-text').textContent = config.label;
    targetValueUnit.textContent = config.unit;
    modeExplanation.textContent = config.desc;
    
    // 현재 모드의 기본값으로 입력값 변경
    state.targetValue = config.defaultValue;
    targetValueInput.value = config.defaultValue;

    // 프리셋 칩 재생성
    presetChips.innerHTML = '';
    config.presets.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip-btn ${p === config.defaultValue ? 'active' : ''}`;
      chip.textContent = `${p}${config.unit}`;
      chip.addEventListener('click', () => {
        targetValueInput.value = p;
        state.targetValue = p;
        presetChips.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        updateItemsCalculatedDimensions();
      });
      presetChips.appendChild(chip);
    });

    // 탭 활성화 상태 변경
    modeSelector.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });

    updateItemsCalculatedDimensions();
  }

  // ==========================================
  // 11. 미리보기 모달 바인딩
  // ==========================================
  function openPreviewModal(item) {
    currentModalItem = item;
    modalFilename.textContent = item.name;
    modalDimensionInfo.textContent = `원본: ${item.width} × ${item.height} (${formatBytes(item.originalSize)}) → 목표: ${item.targetWidth} × ${item.targetHeight}`;
    
    modalOriginalImg.src = item.originalUrl;
    modalOriginalMeta.textContent = `해상도: ${item.width} × ${item.height} | 용량: ${formatBytes(item.originalSize)}`;

    if (item.resizedUrl) {
      modalResizedImg.src = item.resizedUrl;
      modalResizedMeta.textContent = `해상도: ${item.targetWidth} × ${item.targetHeight} | 용량: ${formatBytes(item.resizedSize)}`;
      modalDownloadBtn.disabled = false;
    } else {
      modalResizedImg.src = item.originalUrl;
      modalResizedMeta.textContent = `리사이징 전 대기 중 (목표: ${item.targetWidth} × ${item.targetHeight})`;
      modalDownloadBtn.disabled = true;
    }

    previewModal.classList.remove('hidden');
  }

  function closePreviewModal() {
    previewModal.classList.add('hidden');
    currentModalItem = null;
  }

  // ==========================================
  // 12. 이벤트 리스너 등록
  // ==========================================
  function initEventListeners() {
    // 모드 탭 클릭
    modeSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-btn');
      if (btn && btn.dataset.mode) {
        updateModeUI(btn.dataset.mode);
      }
    });

    // 수치 입력창 변경
    targetValueInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        state.targetValue = val;
        // 프리셋 active 상태 조정
        presetChips.querySelectorAll('.chip-btn').forEach(c => {
          c.classList.toggle('active', c.textContent === `${val}${MODE_CONFIG[state.mode].unit}`);
        });
        updateItemsCalculatedDimensions();
      }
    });

    // 고급 옵션 토글
    toggleAdvanced.addEventListener('click', () => {
      toggleAdvanced.classList.toggle('open');
      advancedContent.classList.toggle('hidden');
    });

    // 출력 포맷 변경
    formatSelect.addEventListener('change', (e) => {
      state.options.format = e.target.value;
      updateItemsCalculatedDimensions();
    });

    // 화질 슬라이더
    qualityRange.addEventListener('input', (e) => {
      const val = e.target.value;
      qualityValue.textContent = `${val}%`;
      state.options.quality = val / 100;
    });

    // 업스케일 방지 체크박스
    noUpscaleCheck.addEventListener('change', (e) => {
      state.options.noUpscale = e.target.checked;
      updateItemsCalculatedDimensions();
    });

    // 접두사 변경
    filePrefixInput.addEventListener('input', (e) => {
      state.options.prefix = e.target.value;
    });

    // 파일 선택 버튼 & 인풋
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
      if (e.target !== selectFilesBtn && !selectFilesBtn.contains(e.target)) {
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      fileInput.value = ''; // 재선택 가능하도록 초기화
    });

    // 드래그 앤 드롭
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    });

    // 클립보드 붙여넣기(Ctrl + V)
    window.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleFiles(e.clipboardData.files);
      }
    });

    // 버튼 액션
    processAllBtn.addEventListener('click', processAllImages);
    downloadZipBtn.addEventListener('click', downloadAllZip);
    clearAllBtn.addEventListener('click', clearAllItems);

    // 뷰 모드 토글
    viewCardsBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      viewCardsBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      imageGrid.classList.remove('list-view');
    });

    viewListBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      viewListBtn.classList.add('active');
      viewCardsBtn.classList.remove('active');
      imageGrid.classList.add('list-view');
    });

    // 모달 닫기
    closeModalBtn.addEventListener('click', closePreviewModal);
    modalCloseActionBtn.addEventListener('click', closePreviewModal);
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) closePreviewModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
        closePreviewModal();
      }
    });

    modalDownloadBtn.addEventListener('click', () => {
      if (currentModalItem) downloadSingleImage(currentModalItem);
    });
  }

  // ==========================================
  // 13. 초기화 (Init)
  // ==========================================
  function init() {
    updateModeUI('width');
    initEventListeners();
  }

  // DOM 준비 완료 시 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
