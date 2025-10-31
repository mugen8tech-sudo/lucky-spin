// apps/admin/src/lib/admin.ts

function unauthorized(): never {
  const err: any = new Error('UNAUTHORIZED');
  err.status = 401;
  throw err;
}

function get(req: Request, h: string) {
  return req.headers.get(h);
}

/** Admin biasa ATAU Super boleh lewat */
export function assertAdmin(req: Request) {
  const ak = get(req, 'x-admin-key');
  const sk = get(req, 'x-super-key');

  const adminOk = !!process.env.ADMIN_API_KEY && ak === process.env.ADMIN_API_KEY;
  const superOk = !!process.env.ADMIN_SUPER_KEY && sk === process.env.ADMIN_SUPER_KEY;

  if (!adminOk && !superOk) unauthorized();
}

/** Khusus halaman/endpoint yang hanya boleh Super Admin */
export function assertSuper(req: Request) {
  const sk = get(req, 'x-super-key');
  if (!process.env.ADMIN_SUPER_KEY || sk !== process.env.ADMIN_SUPER_KEY) {
    unauthorized();
  }
}
