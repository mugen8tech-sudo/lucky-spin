export function assertAdmin(req: Request) {
  const key = req.headers.get('x-admin-key');
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    const err = new Error('UNAUTHORIZED');
    (err as any).status = 401;
    throw err;
  }
}
