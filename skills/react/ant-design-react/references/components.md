# Ant Design Component Patterns

## Remote Select, v6

```tsx
// src/components/remote-user-select.tsx
import { Select } from 'antd';
import type { SelectProps } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { findUsers } from '@/api/users'; // (q: string) => Promise<{ id: string; name: string }[]>

interface UserOption { value: string; label: string }

export function RemoteUserSelect(props: Omit<SelectProps<string, UserOption>, 'options' | 'showSearch' | 'onSearch'>) {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      if (search.trim().length < 2) { setOptions([]); return; }
      setLoading(true);
      try {
        const results = await findUsers(search.trim());
        if (id === requestId.current) setOptions(results.map(user => ({ value: user.id, label: user.name })));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return <Select
    {...props}
    options={options}
    loading={loading}
    showSearch={{ onSearch: setSearch, filterOption: false, searchValue: search }}
    notFoundContent={search.trim().length < 2 ? 'Type at least 2 characters' : loading ? 'Searching…' : 'No users found'}
  />;
}
```

If `findUsers` supports `AbortSignal`, abort on cleanup instead of only dropping stale responses. On antd v5, `onSearch`, `filterOption`, and `searchValue` are top-level props; v6 nests them under `showSearch`.

## Upload

```tsx
// src/features/documents/document-upload.tsx
import { Upload, Button, App } from 'antd';
import type { UploadProps } from 'antd';

export function DocumentUpload() {
  const { message } = App.useApp();
  const props: UploadProps = {
    accept: '.pdf,.png,.jpg,.jpeg',
    maxCount: 5,
    beforeUpload(file) {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
      if (!allowed.includes(file.type)) { message.error('Choose a PDF or image.'); return Upload.LIST_IGNORE; }
      if (file.size > 10 * 1024 * 1024) { message.error('Maximum file size is 10 MB.'); return Upload.LIST_IGNORE; }
      return true;
    },
    action: '/api/documents', // server must verify auth, content, size and file signature
    onChange(info) {
      if (info.file.status === 'done') message.success(`${info.file.name} uploaded`);
      if (info.file.status === 'error') message.error(`${info.file.name} failed`);
    },
  };
  return <Upload {...props}><Button>Upload documents</Button></Upload>;
}
```

Use `customRequest` only when uploading through a signed URL or nonstandard transport. Its callback must call `onProgress`, then exactly one of `onSuccess` / `onError`, and return an abort handle if cancellation is supported. Exact callback generic types depend on the installed antd/rc-upload [VERIFY]. Do not trust MIME type alone; server inspects file bytes.

## Modal / Drawer lifecycle

```tsx
// src/features/users/edit-user-drawer.tsx
import { Drawer, Form, Input, Button } from 'antd';
import { useEffect } from 'react';

interface User { id: string; name: string }

export function EditUserDrawer({ open, user, onClose, onSave }: {
  open: boolean; user?: User; onClose: () => void; onSave: (user: User) => Promise<void>;
}) {
  const [form] = Form.useForm<User>();
  useEffect(() => {
    if (open) form.setFieldsValue(user ?? { id: '', name: '' });
    else form.resetFields();
  }, [open, user, form]);

  return <Drawer open={open} onClose={onClose} destroyOnHidden title="Edit user">
    <Form form={form} preserve={false} layout="vertical" onFinish={onSave}>
      <Form.Item name="id" hidden><Input /></Form.Item>
      <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input autoComplete="name" /></Form.Item>
      <Button htmlType="submit" type="primary">Save</Button>
    </Form>
  </Drawer>;
}
```

`destroyOnHidden` unmounts children after close; `Form preserve={false}` prevents retained values when fields unmount. Use `Modal.useModal()` or `<App>` context for confirmation dialogs; mount the returned `contextHolder` under the providers whose context should be inherited.

## Next.js SSR

```tsx
// app/layout.tsx — App Router
import { AntdRegistry } from '@ant-design/nextjs-registry';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AntdRegistry>{children}</AntdRegistry></body></html>;
}
```

For Pages Router, follow the official `StyleProvider` + `createCache()` + `extractStyle(cache, true)` `_document.tsx` recipe. Keep `@ant-design/cssinjs` version aligned with antd's resolved dependency (`npm ls @ant-design/cssinjs`). Avoid hand-rolled extraction unless the installed Next/antd version requires it.
