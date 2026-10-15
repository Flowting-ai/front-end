// Bundle the real frontend uploader, API parsers, store, and XHR transport for an E2E harness.
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), "library-browser-benchmark-"));
const entry = path.join(temp, "entry.ts");
await writeFile(entry, `
import { createUploadController } from "${root}/src/lib/library/upload/controller";
import { createUploadStore } from "${root}/src/lib/library/upload/store";
import { libraryApi } from "${root}/src/lib/library/api";
import { setInMemoryAccessToken } from "${root}/src/lib/jwt-utils";
setInMemoryAccessToken('benchmark.' + btoa(JSON.stringify({exp: Math.floor(Date.now()/1000)+3600})) + '.local');
const store = createUploadStore();
const controller = createUploadController({store});
window.benchmarkUpload = async ({name, base64, retryFailure = false, skipDownloads = false}) => {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const file = new File([bytes], name);
  const started = performance.now();
  const id = controller.start(file, {draftKey: 'benchmark'});
  const states = [];
  let item;
  while (performance.now() - started < 180000) {
    item = store.get(id);
    if (states.at(-1) !== item?.status) states.push(item?.status);
    document.getElementById('status').textContent = JSON.stringify({name, state:item?.status});
    if (item?.status === 'failed') throw new Error('Frontend upload failed: ' + item.failure);
    if (item?.status === 'ready') break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (item?.status !== 'ready') throw new Error('Frontend upload timed out');
  const originalReadySeconds = (performance.now()-started)/1000;
  let detail = await libraryApi.getFile(item.fileId);
  const earlyProcessingPhase = detail.processingPhase;
  const processingStates = [detail.processingPhase];
  while (detail.processingPending && performance.now()-started < 180000) {
    await new Promise(resolve => setTimeout(resolve, 200));
    detail = await libraryApi.getFile(item.fileId);
    if (processingStates.at(-1) !== detail.processingPhase) processingStates.push(detail.processingPhase);
  }
  if (detail.processingPending) throw new Error('Library processing timed out');
  const totalSeconds = (performance.now()-started)/1000;
  let originalPreserved = null;
  let previewOk = null;
  if (!skipDownloads) {
  const url = await libraryApi.getDownloadUrl(item.fileId);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Download failed');
  const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
  const expected = await crypto.subtle.digest('SHA-256', bytes);
  originalPreserved = new Uint8Array(digest).every((b,i)=>b===new Uint8Array(expected)[i]);
  if (detail.processingPhase === 'ready') {
    const preview = await libraryApi.getPreview(item.fileId, {});
    if ('url' in preview) {
      const download = await fetch(preview.url);
      if (!download.ok) throw new Error('Preview URL failed');
    }
    previewOk = true;
  }
  }
  let retried = false;
  if (retryFailure && detail.processingPhase === 'failed') {
    await libraryApi.retryProcessing(item.fileId);
    let current = await libraryApi.getFile(item.fileId);
    if (!current.processingPending) throw new Error('Retry was not queued');
    for (let poll=0; poll<200; poll++) {
      await new Promise(resolve=>setTimeout(resolve,200));
      current = await libraryApi.getFile(item.fileId);
      if (!current.processingPending) break;
    }
    retried = current.processingPhase === 'failed';
  }
  document.getElementById('status').textContent = JSON.stringify({name, state:'complete', phase:detail.processingPhase});
  return {name, states, processingStates, fileId:item.fileId, originalReadySeconds, totalSeconds, earlyProcessingPhase,
    phase:detail.processingPhase, failure:detail.processingFailure, originalPreserved, previewOk, retried};
};
`);
await build({ entryPoints:[entry], outfile:process.argv[2] ?? "/tmp/document-browser-benchmark.js", bundle:true,
  platform:"browser", format:"iife", target:"es2022", tsconfig:path.join(root,"tsconfig.json"),
  define:{"process.env.NODE_ENV":JSON.stringify("test"), "process.env":"{}", "__dirname":JSON.stringify("/")}, logLevel:"warning" });
