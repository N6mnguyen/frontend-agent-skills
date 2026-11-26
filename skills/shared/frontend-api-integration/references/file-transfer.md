# File Upload and Download

Typed upload-with-progress and download-with-filename helpers for React (fetch/axios) and Angular. `AppError`, `kindFromStatus` and the axios `api` instance come from [client-patterns.md](client-patterns.md).

## 1. File upload with progress

React (fetch has no upload progress; use Axios `onUploadProgress` or XHR):

```ts
// src/features/documents/api/upload.ts
import type { AxiosProgressEvent } from 'axios';
import { api } from '@/core/api/axios-client';

export async function uploadDocument(file: File, onProgress: (pct: number) => void, signal?: AbortSignal) {
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await api.post<unknown>('/documents', form, {
    signal,
    onUploadProgress: (e: AxiosProgressEvent) => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    // No Content-Type header: the browser adds multipart boundary.
  });
  return res.data;
}
```

Angular 22 (requires `provideHttpClient(withXhr(), ...)` because the default fetch backend throws on upload progress):

```ts
// src/app/features/documents/document-upload.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { filter, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DocumentUploadService {
  private readonly http = inject(HttpClient);

  upload(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<unknown>('/api/documents', form, { reportUploadProgress: true, observe: 'events' }).pipe(
      filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e) =>
        e.type === HttpEventType.UploadProgress
          ? { done: false as const, pct: e.total ? Math.round((100 * e.loaded) / e.total) : 0 }
          : { done: true as const, body: e.body },
      ),
    );
  }
}
```

Angular 17–21: use `reportProgress: true` instead (XHR is already the default backend there unless the app added `withFetch()`). `reportProgress` is deprecated in 22.

## 2. File download with filename

```ts
// src/core/api/download.ts
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star?.[1]) {
    try { return sanitize(decodeURIComponent(star[1].trim())); } catch { /* fall through */ }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header);
  return plain?.[1] ? sanitize(plain[1].trim()) : fallback;
}

const sanitize = (name: string) => name.replace(/[/\\?%*:|"<>\u0000-\u001f]/g, '_').slice(0, 200);

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

```ts
// React/fetch usage
const res = await fetch('/api/reports/42/export', { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new AppError(kindFromStatus(res.status), `HTTP ${res.status}`, res.status);
saveBlob(await res.blob(), filenameFromDisposition(res.headers.get('Content-Disposition'), 'report.csv'));
```

```ts
// Angular usage
this.http.get('/api/reports/42/export', { responseType: 'blob', observe: 'response' }).subscribe((res) => {
  if (res.body) saveBlob(res.body, filenameFromDisposition(res.headers.get('Content-Disposition'), 'report.csv'));
});
```

Cross-origin APIs must send `Access-Control-Expose-Headers: Content-Disposition` or the header reads as `null`. For very large files, prefer a direct link to a short-lived signed URL so the browser streams to disk instead of buffering a Blob in memory.
