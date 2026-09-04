// Cloudflare Worker-level Access runs before the Worker and supplies ctx.access.
// The application does not reimplement JWT/JWKS/AUD validation.
export async function authorizeAccess(_request, _env, executionContext) {
  if (executionContext?.access) {
    return { ok: true, status: 200, aud: String(executionContext.access.aud || '') };
  }
  return { ok: false, status: 401, code: 'access_required' };
}

