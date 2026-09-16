/* POST /.netlify/functions/tr-checkout
   Body: {hotel (resort slug or ""), zone, place, placeKind, airport, trip, people, vehicle, seats, date, date2, flightIn, flightOut, timeIn, timeOut, time, note, ref, customer:{first,last,email,phone}}
   The price is looked up again here from the rates module the build writes (netlify/functions/_tr-data.mjs): the hotel's own row
   where it has one, otherwise its zone. The browser's numbers are never trusted. Hotel-to-hotel rides have no rates and are refused
   (they go by WhatsApp). Opens a Stripe Checkout Session and returns {url}. The session's metadata is shaped like the Experiences
   bookings, so the same exp-webhook confirms it on payment and the same exp-status feeds the confirmation page. */
import { json, SITE, stripe, longDate, todayJamaica } from "./_exp-shared.mjs";
import { TR } from "./_tr-data.mjs";

const clean = (s, n = 120) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);
const FLIGHT = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
const TIME = /^(1[0-2]|0?[1-9])(:[0-5]\d)?(am|pm)$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const airportOf = (code) => TR.airports.find((a) => a.code === code) || null;
const zoneOf = (key) => TR.zones.find((z) => z.key === key) || null;
const tripOf = (key) => TR.trips.find((t) => t.key === key) || null;

/* the offers a search would have shown: the zone's prices from the airport (one price per zone), minus the sizes the sheet says to
   quote by hand for that hotel; hotel to hotel from the zone-pair links */
export function offersFor(hotelSlug, zoneKey, airport, trip, zone2) {
  if (trip === "hotel") {
    if (!zone2 || zone2 === zoneKey) return null;
    const links = TR.links || {};
    return links[`${zoneKey}>${zone2}`] || links[[zoneKey, zone2].sort().join("|")] || null;
  }
  const h = hotelSlug ? TR.hotelKeys[hotelSlug] : null;
  const own = h && h.rate && TR.rates[h.rate] && TR.rates[h.rate][airport] && TR.rates[h.rate][airport][trip];
  const zone = TR.zoneRates[zoneKey] && TR.zoneRates[zoneKey][airport] && TR.zoneRates[zoneKey][airport][trip];
  const list = own || zone || null;
  if (!list || !hotelSlug) return list;
  return list.filter((o) => !(TR.exceptions || []).some((x) => x.airport === airport && x.zone === zoneKey && x.seats === o[1] && x.hotels.includes(hotelSlug)));
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad JSON" }); }
  const trip = tripOf(b.trip), airport = airportOf(b.airport), zone = zoneOf(b.zone), vehicle = TR.vehicles[b.vehicle] ? b.vehicle : null;
  if (!trip || !airport || !zone || !vehicle) return json(404, { error: "Unknown ride" });
  const hotelSlug = clean(b.hotel, 80);
  const hotel = hotelSlug ? TR.hotelKeys[hotelSlug] : null;
  if (hotelSlug && !hotel) return json(404, { error: "Unknown hotel" });
  if (hotel && hotel.zone !== zone.key) return json(400, { error: "That hotel is not in that area." });
  /* hotel to hotel: the other end, priced by zone pair */
  const isHotelTrip = trip.key === "hotel";
  const zone2 = isHotelTrip ? zoneOf(b.zone2) : null;
  const hotel2Slug = isHotelTrip ? clean(b.hotel2, 80) : "";
  const hotel2 = hotel2Slug ? TR.hotelKeys[hotel2Slug] : null;
  if (isHotelTrip && !zone2) return json(404, { error: "Unknown ride" });
  if (isHotelTrip && hotel2Slug && !hotel2) return json(404, { error: "Unknown hotel" });
  if (isHotelTrip && hotel2 && hotel2.zone !== zone2.key) return json(400, { error: "That hotel is not in that area." });
  const people = Math.max(1, Math.min(TR.maxGuests, Number(b.people) || 0));
  if ((Number(b.people) || 0) > TR.maxGuests) return json(400, { error: `More than ${TR.maxGuests} people is priced by hand. Send it as a WhatsApp request.` });
  const seats = Number(b.seats) || 0;
  const offers = offersFor(hotelSlug, zone.key, airport.code, trip.key, zone2 && zone2.key);
  if (isHotelTrip && !offers) return json(400, { error: "That hotel to hotel ride is priced in the chat. Send it as a WhatsApp request." });
  const offer = offers ? offers.find((o) => o[0] === vehicle && o[1] === seats) : null;
  if (!offer) return json(400, { error: "That vehicle is not on the list for this ride. Search again and pick from the table." });
  if (seats < people) return json(400, { error: `That vehicle takes up to ${seats}. Pick a bigger one.` });
  const total = offer[3];
  const needIn = trip.key === "in" || trip.key === "both", needOut = trip.key === "out" || trip.key === "both";
  const today = todayJamaica();
  const date = clean(b.date, 10), date2 = trip.key === "both" ? clean(b.date2, 10) : "";
  const flightIn = needIn ? clean(b.flightIn, 12).toUpperCase() : "", flightOut = needOut ? clean(b.flightOut, 12).toUpperCase() : "";
  const timeIn = needIn ? clean(b.timeIn, 10).toLowerCase().replace(/\s+/g, "") : "", timeOut = needOut ? clean(b.timeOut, 10).toLowerCase().replace(/\s+/g, "") : "";
  const pickupTime = isHotelTrip ? clean(b.time, 10).toLowerCase().replace(/\s+/g, "") : "";
  if (!ISO.test(date) || date < today) return json(400, { error: isHotelTrip ? "Pick the date." : needIn ? "Pick your arrival date." : "Pick your departure date." });
  if (isHotelTrip && !TIME.test(pickupTime)) return json(400, { error: "What time should the driver come? e.g. 10:00am" });
  if (needIn && !FLIGHT.test(flightIn)) return json(400, { error: "We need the arriving flight number, e.g. AA1497." });
  if (needIn && !TIME.test(timeIn)) return json(400, { error: "What time does the flight land? e.g. 2:35pm" });
  if (needOut) {
    if (trip.key === "both" && (!ISO.test(date2) || date2 < date)) return json(400, { error: "Pick the departure date too." });
    if (!FLIGHT.test(flightOut)) return json(400, { error: "We need the departing flight number, e.g. AA1496." });
    if (!TIME.test(timeOut)) return json(400, { error: "What time does the flight take off? e.g. 11:10am" });
  }
  const place = clean(b.place, 120), placeKind = b.placeKind === "zone" ? "zone" : "hotel";
  if (!place || (placeKind === "zone" && !/\(/.test(place))) return json(400, { error: isHotelTrip ? "Where does the ride start? The driver needs the hotel or the villa name." : "Where are you staying? The driver needs the hotel or the villa name." });
  const place2 = isHotelTrip ? clean(b.place2, 120) : "", place2Kind = b.place2Kind === "zone" ? "zone" : "hotel";
  if (isHotelTrip && (!place2 || (place2Kind === "zone" && !/\(/.test(place2)))) return json(400, { error: "Where is the ride going? The driver needs the hotel or the villa name." });
  const c = b.customer || {};
  const first = clean(c.first, 60), last = clean(c.last, 60), email = clean(c.email, 120), phone = clean(c.phone, 40), note = clean(b.note, 200);
  if (!first || !last) return json(400, { error: "We need a first and last name for the booking." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "That email doesn't look right." });
  if (!phone) return json(400, { error: "We need a phone or WhatsApp number, for the driver." });
  const ref = /^GV-TR-[A-Z0-9]{4}$/.test(b.ref || "") ? b.ref : `GV-TR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const vehLabel = TR.vehicles[vehicle].label + (offer[4] ? ", two or more" : "");
  const routeName = isHotelTrip ? `${zone.name} to ${zone2.name}` : trip.key === "out" ? `${zone.name} to ${airport.name} airport` : trip.key === "both" ? `${airport.name} airport to ${zone.name}, round trip` : `${airport.name} airport to ${zone.name}`;
  const productName = `${routeName}, ${vehLabel.toLowerCase()} up to ${seats}, ${trip.label.toLowerCase()}`;
  const whenDesc = isHotelTrip ? `${longDate(date)} at ${pickupTime}` : [flightIn ? `arrives ${longDate(date)} on ${flightIn} at ${timeIn}` : "", flightOut ? `departs ${longDate(trip.key === "both" ? date2 : date)} on ${flightOut} at ${timeOut}` : ""].filter(Boolean).join(", ");
  const desc = `${productName}. ${whenDesc}. ${people} ${people === 1 ? "person" : "people"}, ${place}${isHotelTrip ? ` to ${place2}` : ""}.`;
  /* the metadata keys match the Experiences bookings so exp-webhook, exp-status and the team's forms read it the same way */
  const metadata = {
    ref, kind: "transfer", slug: hotelSlug || zone.key, product: `${vehicle}-${seats}-${trip.key}`, venue_name: isHotelTrip ? "Hotel to hotel transfer" : "Airport transfer", product_name: productName, confirm: "team",
    date, time: pickupTime, date2, flight_in: flightIn, flight_out: flightOut, rezdy_code: "", rezdy_start: "",
    adults: String(people), children: "0", pickup: placeKind, pickup_label: place, pickup_hotel: "", choices: "",
    ship: "", port: "", port_name: "", aboard: "", first, last, email, phone, total_usd: String(total), rezdy_status: "", note: [note, timeIn ? `lands ${timeIn}` : "", timeOut ? `takes off ${timeOut}` : ""].filter(Boolean).join(" · "), airport: isHotelTrip ? "" : airport.code, zone: zone.key, zone2: zone2 ? zone2.key : "", to_label: place2, seats: String(seats),
  };
  try {
    const session = await stripe("/checkout/sessions", {
      mode: "payment",
      customer_email: email,
      client_reference_id: ref,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(total * 100), product_data: { name: `${isHotelTrip ? "Hotel to hotel transfer" : "Airport transfer"}: ${productName}`, description: desc.slice(0, 500) } } }],
      metadata,
      payment_intent_data: { metadata, description: `${ref} ${isHotelTrip ? "Hotel to hotel transfer" : "Airport transfer"}: ${desc}`.slice(0, 1000) },
      success_url: `${SITE}/transfers/booked?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/transfers?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
    });
    return json(200, { url: session.url, ref });
  } catch (e) {
    console.error("stripe session", e.message);
    return json(502, { error: "The payment page didn't open." });
  }
};
