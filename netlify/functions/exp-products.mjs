/* GET /.netlify/functions/exp-products?token=...   (admin only, needs EXP_ADMIN_TOKEN in Netlify)
   Lists the products the agent account can sell, with codes and price option labels, so data/rezdy-map.json can be pinned.
   Shows retail figures only; never the negotiated net rate. */
import { json, rezdyProducts } from "./_exp-shared.mjs";

export const handler = async (event) => {
  const token = process.env.EXP_ADMIN_TOKEN;
  const given = (event.queryStringParameters || {}).token || "";
  if (!token || given !== token) return json(404, { error: "Not found" });
  try {
    const list = await rezdyProducts((event.queryStringParameters || {}).search || "");
    const out = list.map((p) => ({
      code: p.productCode, name: p.name, supplier: p.supplierName || p.supplierAlias || "", bookingMode: p.bookingMode, confirmMode: p.confirmMode, agentPaymentType: p.agentPaymentType,
      advertisedPrice: p.advertisedPrice, currency: p.currency, minQty: p.quantityRequiredMin, maxQty: p.quantityRequiredMax,
      priceOptions: (p.priceOptions || []).map((o) => ({ label: o.label, price: o.price, seatsUsed: o.seatsUsed })),
      bookingFields: (p.bookingFields || []).filter((f) => f.requiredPerBooking || f.requiredPerParticipant).map((f) => ({ label: f.label, perBooking: !!f.requiredPerBooking, perParticipant: !!f.requiredPerParticipant })),
      pickupId: p.pickupId || null,
    }));
    return json(200, { count: out.length, products: out });
  } catch (e) {
    return json(502, { error: e.message });
  }
};
