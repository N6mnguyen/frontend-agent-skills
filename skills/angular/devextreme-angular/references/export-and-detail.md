# DevExtreme DataGrid: export and master-detail

Targets devextreme-angular 26.x. On older majors the Excel library is usually `exceljs` instead of `devextreme-exceljs-fork`; keep whichever `package.json` already has.

## Excel export

```bash
npm install --save-exact devextreme-exceljs-fork
npm install --save file-saver
npm install --save-dev @types/file-saver
```

```ts
// src/app/orders/orders-export.ts
import { Workbook } from 'devextreme-exceljs-fork';
import saveAs from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { DxDataGridTypes } from 'devextreme-angular/ui/data-grid';

const MAX_EXPORT_ROWS = 50_000;

export async function exportOrders(e: DxDataGridTypes.ExportingEvent): Promise<void> {
  e.cancel = true; // we handle the file ourselves

  const total = e.component.totalCount();
  if (total > MAX_EXPORT_ROWS) {
    // Large exports belong on the server (streamed CSV/XLSX), not in the browser.
    alert(`Too many rows (${total}). Narrow the filter or use "Export all" on the server.`);
    return;
  }

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Orders');
  await exportDataGrid({ component: e.component, worksheet: sheet, autoFilterEnabled: true });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
```

With remote operations, `exportDataGrid` asks the store for every row matching the current filter and sort. That is why the row cap exists. Replace `alert` with the project's notification service.

Whether `e.cancel` must be set in v26 or the event no longer has a default export action should be checked in the installed typings [VERIFY]. PDF export follows the same shape with `exportDataGrid` from `devextreme/pdf_exporter` and a `jsPDF` document.

## Master-detail with lazy loading

```ts
// src/app/orders/order-lines.component.ts
import { Component, inject, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { DxDataGridModule } from 'devextreme-angular';

interface OrderLine { id: number; sku: string; qty: number; price: number }

@Component({
  selector: 'app-order-lines',
  imports: [DxDataGridModule],
  template: `
    @if (lines.error()) {
      <p role="alert">Lines could not be loaded.</p>
    } @else {
      <dx-data-grid [dataSource]="lines.value() ?? []" keyExpr="id" [showBorders]="true"
                    [disabled]="lines.isLoading()">
        <dxi-data-grid-column dataField="sku" />
        <dxi-data-grid-column dataField="qty" dataType="number" />
        <dxi-data-grid-column dataField="price" dataType="number" format="currency" />
      </dx-data-grid>
    }
  `,
})
export class OrderLinesComponent {
  private readonly http = inject(HttpClient);
  readonly orderId = input.required<number>();

  // Fetches only when the row is expanded (component created by the detail template).
  protected readonly lines = rxResource({
    params: () => ({ id: this.orderId() }),
    stream: ({ params }) => this.http.get<OrderLine[]>(`/api/orders/${params.id}/lines`),
  });
}
```

`rxResource` with `params`/`stream` is the v20+ shape (v19 used `request`/`loader`). On Angular 17-18, replace it with a `toSignal(this.http.get(...))` initialized in the constructor, or a plain subscription with `takeUntilDestroyed()`.
