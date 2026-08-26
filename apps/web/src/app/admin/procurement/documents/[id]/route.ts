import { loadEnvironment } from "@rava/config";
import { getPurchaseDocumentForAdmin } from "@rava/db";
import { createPrivateStorage } from "@rava/integrations";

import { requireAdmin } from "../../../../../server/admin";
import { database } from "../../../../../server/db";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: RouteContext<"/admin/procurement/documents/[id]">,
) {
  await requireAdmin("PROCUREMENT_READ");
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const document = await getPurchaseDocumentForAdmin(database(), id);
  if (document === null) return new Response("Not found", { status: 404 });
  const object = await createPrivateStorage(loadEnvironment()).getPrivate(
    document.storageKey,
  );
  if (object === null) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(object.body), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": document.contentType,
      "Content-Disposition": `inline; filename="purchase-receipt-${document.id}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
