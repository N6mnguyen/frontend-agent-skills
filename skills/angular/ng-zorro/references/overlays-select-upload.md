# ng-zorro: modal, remote select, upload

Angular 17+ standalone, ng-zorro-antd major matching Angular. NgModule projects import the same `Nz*Module`s in the owning module.

## Modal with typed data and result

```ts
// src/app/orders/edit-order-modal.component.ts
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';

export interface EditOrderData { id: string; name: string }
export interface EditOrderResult { name: string }

@Component({
  selector: 'app-edit-order-modal',
  imports: [ReactiveFormsModule, NzFormModule, NzInputModule],
  template: `
    <form nz-form [formGroup]="form">
      <nz-form-item>
        <nz-form-label nzFor="order-name" nzRequired>Name</nz-form-label>
        <nz-form-control nzErrorTip="Name is required.">
          <input nz-input id="order-name" formControlName="name" />
        </nz-form-control>
      </nz-form-item>
    </form>
  `,
})
export class EditOrderModalComponent {
  private readonly data = inject<EditOrderData>(NZ_MODAL_DATA);
  private readonly ref = inject<NzModalRef<EditOrderModalComponent, EditOrderResult>>(NzModalRef);
  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.name, Validators.required],
  });

  /** Called by the opener's nzOnOk. Returning false keeps the modal open. */
  submit(): EditOrderResult | false {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // nz-form-control may need updateValueAndValidity to refresh its status
      Object.values(this.form.controls).forEach((c) => { c.markAsDirty(); c.updateValueAndValidity(); });
      return false;
    }
    return this.form.getRawValue();
  }
}
```

```ts
// src/app/orders/orders-actions.ts
import { Injectable, inject } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable } from 'rxjs';
import { EditOrderData, EditOrderModalComponent, EditOrderResult } from './edit-order-modal.component';

@Injectable({ providedIn: 'root' })
export class OrdersActions {
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);

  edit(data: EditOrderData): Observable<EditOrderResult | undefined> {
    const ref = this.modal.create<EditOrderModalComponent, EditOrderData, EditOrderResult>({
      nzTitle: 'Edit order',
      nzContent: EditOrderModalComponent,
      nzData: data,
      nzOnOk: (cmp) => {
        const result = cmp.submit();
        if (result === false) return false;
        ref.close(result);
        this.message.success('Order updated');
        return undefined;
      },
    });
    return ref.afterClose;
  }
}
```

The generic parameter order of `NzModalService.create<T, D, R>` should be checked against the installed typings [VERIFY]. `NzDrawerService.create` follows the same shape with `NZ_DRAWER_DATA`, `NzDrawerRef.close(result)`, and `afterClose`.

## Remote search select

```ts
// src/app/customers/customer-select.component.ts
import { Component, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { CustomersApi, CustomerOption } from './customers.api';

@Component({
  selector: 'app-customer-select',
  imports: [FormsModule, NzSelectModule],
  template: `
    <nz-select nzShowSearch nzServerSearch nzAllowClear nzPlaceHolder="Search customers"
      [nzLoading]="loading()" [(ngModel)]="value" (nzOnSearch)="search$.next($event)"
      [nzNotFoundContent]="failed() ? 'Search failed, try again' : 'No customers found'">
      @for (o of options(); track o.id) { <nz-option [nzValue]="o.id" [nzLabel]="o.name" /> }
    </nz-select>
  `,
})
export class CustomerSelectComponent {
  private readonly api = inject(CustomersApi);
  readonly value = model<string | null>(null);
  protected readonly options = signal<CustomerOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter((term) => term.trim().length >= 2),
      tap(() => { this.loading.set(true); this.failed.set(false); }),
      switchMap((term) => this.api.search(term).pipe(
        catchError(() => { this.failed.set(true); return of<CustomerOption[]>([]); }),
      )),
      takeUntilDestroyed(),
    ).subscribe((list) => { this.options.set(list); this.loading.set(false); });
  }
}
```

`switchMap` cancels the in-flight request when the user keeps typing, so late responses never overwrite newer results. Inside a reactive form, wrap this as a `ControlValueAccessor` (see the `angular-reactive-forms` skill) rather than using `ngModel`.

## Manual upload with client hints and server validation

```ts
// src/app/documents/document-upload.component.ts
import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg']);

@Component({
  selector: 'app-document-upload',
  imports: [NzUploadModule, NzButtonModule],
  template: `
    <nz-upload [nzBeforeUpload]="beforeUpload" [nzFileList]="files()" nzAccept=".pdf,.png,.jpg"
               (nzFileListChange)="files.set($event)">
      <button nz-button type="button">Select files</button>
    </nz-upload>
    <button nz-button nzType="primary" type="button" [disabled]="!files().length || uploading()"
            (click)="upload()">{{ uploading() ? 'Uploading…' : 'Upload' }}</button>
    <p aria-live="polite">{{ progress() !== null ? progress() + '% uploaded' : '' }}</p>
  `,
})
export class DocumentUploadComponent {
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  protected readonly files = signal<NzUploadFile[]>([]);
  protected readonly uploading = signal(false);
  protected readonly progress = signal<number | null>(null);

  // Arrow function: ng-zorro calls it without `this` binding.
  protected beforeUpload = (file: NzUploadFile): boolean => {
    const raw = file as unknown as File;
    if (!ALLOWED.has(raw.type) || raw.size > MAX_BYTES) {
      this.message.error(`${file.name}: only PDF/PNG/JPEG up to 5 MB.`);
      return false;
    }
    this.files.update((list) => [...list, file]);
    return false; // manual mode: never auto-upload
  };

  protected upload(): void {
    const body = new FormData();
    for (const f of this.files()) body.append('files', f as unknown as File);
    this.uploading.set(true);
    this.http.post('/api/documents', body, { reportProgress: true, observe: 'events' }).subscribe({
      next: (e) => {
        if (e.type === HttpEventType.UploadProgress && e.total) this.progress.set(Math.round((100 * e.loaded) / e.total));
        if (e.type === HttpEventType.Response) { this.files.set([]); this.message.success('Uploaded'); }
      },
      error: () => { this.message.error('Upload failed. Files were kept; try again.'); this.uploading.set(false); },
      complete: () => { this.uploading.set(false); this.progress.set(null); },
    });
  }
}
```

The type/size checks are UX only. The server must re-check MIME (by content, not extension), size, virus scanning policy, and authorization.
