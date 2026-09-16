#!/usr/bin/env node
/**
 * Batch upload photos to Nixplay via browser CDP injection.
 * Generates JS snippets - run upload loop inside authenticated browser tab.
 *
 * Fix: Nixplay upload API uses playlistId, not albumId.
 */
const fs = require('fs');
const path = require('path');

const CONFIG = JSON.parse(
  fs.readFileSync(process.env.NIXPLAY_CONFIG || path.join(__dirname, 'nixplay_config.json'), 'utf8'),
);
const PHOTOS_DIR = process.env.PHOTOS_DIR || path.join(__dirname, '.data', 'best2025_upload');
const PLAYLIST_ID = CONFIG.playlistId;
const FRAME_ID = CONFIG.frameId || process.env.NIXPLAY_FRAME_ID || '';

const UPLOAD_FN = `
window.__nixplayUpload = async function(playlistId, fileName, base64Data) {
  const csrf = (document.cookie.match(/prod\\.csrftoken=([^;]+)/) || [])[1];
  const token = localStorage.getItem('nixplay.token');
  const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token, 'X-CsrfToken': csrf };
  const bin = atob(base64Data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const fileSize = blob.size;
  const recv = await fetch('https://api.nixplay.com/v3/upload/receivers/', {
    method: 'POST', credentials: 'include', headers,
    body: new URLSearchParams({ playlistId, total: '1' }),
  });
  const recvData = await recv.json();
  if (!recv.ok) return { ok: false, step: 'receiver', status: recv.status, data: recvData };
  const creds = await fetch('https://api.nixplay.com/v3/photo/upload/', {
    method: 'POST', credentials: 'include', headers,
    body: new URLSearchParams({
      playlistId, uploadToken: recvData.token, fileName,
      fileType: 'image/jpeg', fileSize: String(fileSize),
    }),
  });
  const credsData = await creds.json();
  if (!creds.ok) return { ok: false, step: 'creds', status: creds.status, data: credsData };
  const d = credsData.data;
  const form = new FormData();
  form.append('key', d.key);
  form.append('acl', d.acl);
  form.append('content-type', d.fileType);
  form.append('x-amz-meta-batch-upload-id', d.batchUploadId);
  form.append('success_action_status', '201');
  form.append('AWSAccessKeyId', d.AWSAccessKeyId);
  form.append('Policy', d.Policy);
  form.append('Signature', d.Signature);
  form.append('file', blob, fileName);
  const s3 = await fetch(d.s3UploadUrl, { method: 'POST', body: form });
  return { ok: s3.status === 201, step: 's3', status: s3.status, fileName, fileSize };
};

window.__runBatchUpload = async function(playlistId, items) {
  const progress = { done: 0, total: items.length, errors: [], status: 'running' };
  window.__nixplayUploadProgress = progress;
  for (const item of items) {
    try {
      const r = await window.__nixplayUpload(playlistId, item.name, item.b64);
      if (!r.ok) progress.errors.push({ name: item.name, result: r });
      else progress.done++;
    } catch (e) {
      progress.errors.push({ name: item.name, error: String(e) });
    }
  }
  progress.status = 'done';
  return progress;
};
'ready';
`;

function getPhotos() {
  return fs.readdirSync(PHOTOS_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => ({
      name: f,
      b64: fs.readFileSync(path.join(PHOTOS_DIR, f)).toString('base64'),
    }));
}

if (require.main === module) {
  const cmd = process.argv[2] || 'inject';
  if (cmd === 'inject') {
    console.log(UPLOAD_FN);
  } else if (cmd === 'batch') {
    const start = parseInt(process.argv[3] || '0', 10);
    const count = parseInt(process.argv[4] || '10', 10);
    const photos = getPhotos().slice(start, start + count);
    const expr = `(async () => {
      const items = ${JSON.stringify(photos)};
      return await window.__runBatchUpload('${PLAYLIST_ID}', items);
    })()`;
    console.log(expr);
  } else if (cmd === 'assign') {
    console.log(`(async () => {
      const csrf = (document.cookie.match(/prod\\.csrftoken=([^;]+)/)||[])[1];
      const headers = {Accept:'application/json', Authorization:'Bearer '+localStorage.getItem('nixplay.token'), 'X-CsrfToken': csrf, 'Content-Type':'application/json'};
      const r = await fetch('https://api.nixplay.com/v3/frames/${FRAME_ID}/playlists/', {method:'POST', credentials:'include', headers, body: JSON.stringify([{id: ${PLAYLIST_ID}, order: 0}])});
      return {status: r.status, body: await r.text()};
    })()`);
  } else if (cmd === 'delete-legacy') {
    const ids = ['1442052', '1442570', '1480977', '1877785'];
    console.log(`(async () => {
      const csrf = (document.cookie.match(/prod\\.csrftoken=([^;]+)/)||[])[1];
      const headers = {Accept:'application/json', Authorization:'Bearer '+localStorage.getItem('nixplay.token'), 'X-CsrfToken': csrf};
      const results = [];
      for (const id of ${JSON.stringify(ids)}) {
        const r = await fetch('https://api.nixplay.com/v3/playlists/nixplay/?playlistId='+id, {method:'DELETE', credentials:'include', headers});
        results.push({id, status:r.status, body:(await r.text()).slice(0,200)});
      }
      return results;
    })()`);
  }
}
