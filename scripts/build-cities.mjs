/* Golden Vacation & Travel — public/assets/cities.json
   ----------------------------------------------------------------------------------------------
   The list behind the "Flying from" box on the Coming to Jamaica tab. Every city in the world that
   has an airport with an IATA code, one row per city rather than one per airport, so New York is a
   single suggestion and not three. The airport codes ride along in the search words, so typing YYZ
   finds Toronto and typing Toronto finds it too.

   The file is lazy-loaded by home.js the first time somebody types in that box, exactly the way
   jm-places.json is, so it never touches the page load.

     node scripts/build-cities.mjs path/to/airports.dat

   airports.dat is the OpenFlights airport table (openflights/data/airports.dat). It is not kept in
   this repo: the generated JSON is the committed artefact. Re-run it only when the list needs to
   change.

   Row shape: [city, country, codes, rank]  — lower rank sorts first. The cities in FIRST are
   ranked in the order they are listed there; everything else is 9999 and sorts by name.
*/
import fs from "node:fs";

const SRC = process.argv[2] || "airports.dat";

/* Cities that actually fly to Jamaica, or that our travellers actually come from, busiest first.
   They sort above everything else, so "new" is New York before Newcastle and "canada" is Toronto
   before Alma. Nothing is hidden by this: every other city in the world is still in the list and
   still found by typing its name. */
const FIRST = [
  ["New York", "United States"], ["Newark", "United States"], ["Philadelphia", "United States"],
  ["Baltimore", "United States"], ["Washington", "United States"], ["Boston", "United States"],
  ["Hartford", "United States"], ["Charlotte", "United States"], ["Atlanta", "United States"],
  ["Orlando", "United States"], ["Miami", "United States"], ["Fort Lauderdale", "United States"],
  ["Tampa", "United States"], ["Chicago", "United States"], ["Detroit", "United States"],
  ["Minneapolis", "United States"], ["Houston", "United States"], ["Dallas-Fort Worth", "United States"],
  ["Los Angeles", "United States"], ["San Francisco", "United States"], ["Seattle", "United States"],
  ["Phoenix", "United States"], ["Las Vegas", "United States"], ["Denver", "United States"],
  ["Toronto", "Canada"], ["Montreal", "Canada"], ["Ottawa", "Canada"], ["Calgary", "Canada"],
  ["Vancouver", "Canada"], ["Winnipeg", "Canada"], ["Halifax", "Canada"],
  ["London", "United Kingdom"], ["Manchester", "United Kingdom"], ["Birmingham", "United Kingdom"],
  ["Glasgow", "United Kingdom"], ["Panama City", "Panama"], ["Bogota", "Colombia"],
  ["Medellin", "Colombia"], ["Cartagena", "Colombia"], ["Lima", "Peru"],
  ["Punta Cana", "Dominican Republic"], ["Santo Domingo", "Dominican Republic"],
  ["Nassau", "Bahamas"], ["Port-au-Prince", "Haiti"], ["Havana", "Cuba"],
  ["Kingston", "Jamaica"], ["Montego Bay", "Jamaica"], ["Georgetown", "Cayman Islands"],
  ["Bridgetown", "Barbados"], ["Port-of-spain", "Trinidad and Tobago"], ["San Juan", "Puerto Rico"],
  ["Willemstad", "Netherlands Antilles"], ["Oranjestad", "Aruba"], ["Cancun", "Mexico"],
  ["Mexico City", "Mexico"], ["Sao Paulo", "Brazil"], ["Frankfurt", "Germany"],
  ["Amsterdam", "Netherlands"], ["Paris", "France"], ["Madrid", "Spain"], ["Dublin", "Ireland"],
];


function parse(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const first = new Map(FIRST.map(([c, k], i) => [(c + "|" + k).toLowerCase(), i + 1]));
const cities = new Map();

for (const line of fs.readFileSync(SRC, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const f = parse(line);
  if (f.length < 14) continue;
  const city = f[2].trim(), country = f[3].trim(), iata = f[4].trim(), kind = f[12].trim();
  if (kind !== "airport") continue;
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  if (!city || city === "\\N" || !country || country === "\\N") continue;
  const key = city.toLowerCase() + "|" + country.toLowerCase();
  if (!cities.has(key)) cities.set(key, { city, country, codes: [] });
  const row = cities.get(key);
  if (!row.codes.includes(iata)) row.codes.push(iata);
}

const rows = [...cities.values()]
  .map((r) => [r.city, r.country, r.codes.sort().join(" "), first.get((r.city + "|" + r.country).toLowerCase()) || 9999])
  .sort((a, b) => (a[3] - b[3]) || a[0].localeCompare(b[0]));

const json = JSON.stringify({ cities: rows });
fs.writeFileSync("public/assets/cities.json", json);
console.log("wrote public/assets/cities.json", rows.length, "cities,", (json.length / 1024).toFixed(0) + "K");
