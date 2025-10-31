function unauthorized(): never {
  const err: any = new Error('UNAUTHORIZED');
  err.status = 401;
  throw err;
}

function getHeader(req: Request, name: string): string | null {
  // Headers case-insensitive; .get sudah cukup, helper disiapkan untuk konsistensi
  return req.headers.get(name);
}

/** Wajib admin biasa */
export function assertAdmin(req: Request) {
  const key = getHeader(req, 'x-admin-key');
  if (!process.env.ADMIN_API_KEY || !key || key !== process.env.ADMIN_API_KEY) {
    unauthorized();
  }
}

/** Wajib super admin */
export function assertSuper(req: Request) {
  const key = getHeader(req, 'x-super-key');
  if (!process.env.ADMIN_SUPER_KEY || !key || key !== process.env.ADMIN_SUPER_KEY) {
    unauthorized();
  }
}

/** Boleh admin biasa ATAU super admin */
export function assertAdminOrSuper(req: Request) {
  const adminOk = !!process.env.ADMIN_API_KEY &&
                  getHeader(req, 'x-admin-key') === process.env.ADMIN_API_KEY;
  const superOk = !!process.env.ADMIN_SUPER_KEY &&
                  getHeader(req, 'x-super-key') === process.env.ADMIN_SUPER_KEY;
  if (!adminOk && !superOk) unauthorized();
}
