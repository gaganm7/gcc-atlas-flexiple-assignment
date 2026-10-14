// The checks, the counts and the sums. No DOM in here.

// ---------- Quotes ----------

// Pages and pasted text differ in curly quotes, dashes and stray spaces. Both sides of every
// comparison go through this, so a quote matches only when its words are really there.
export const normalize = text => String(text ?? '')
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/[     ]/g, ' ')
  .replace(/[​-‍﻿]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/ ([,.;:!?])/g, '$1')
  .trim();

// A quote counts only if the source contains it word for word and it is long enough to mean something.
export const quoteFound = (source, quote) => normalize(quote).length >= 20 && normalize(source).includes(normalize(quote));

// ---------- The record ----------

export const STATES = { Bengaluru: 'Karnataka', Chennai: 'Tamil Nadu', Gurugram: 'Haryana', Hyderabad: 'Telangana', Mumbai: 'Maharashtra', Noida: 'Uttar Pradesh', Pune: 'Maharashtra' };
export const EVENTS = { opened: 'Opened', announced: 'Announced', expanded: 'Expanding', leased: 'Leased space' };
export const KINDS = { company: 'Company statement', government: 'Government statement', news: 'News report' };

// The outside parties a source can name. These three are the ones the sources do name.
export const LINKS = {
  government: { label: 'Government', one: 'a state government', help: 'A state government, agency or minister named as involved.' },
  partner: { label: 'Setup partner', one: 'a setup partner', help: 'An outside firm named as helping set up, build or run the centre.' },
  workplace: { label: 'Workplace', one: 'a building or landlord', help: 'A named building, business park or landlord.' }
};
// How many records name each kind of party, most often first.
export function coverage(records) {
  return Object.entries(LINKS)
    .map(([key, link]) => ({ key, ...link, named: records.filter(record => record[key]).length, total: records.length }))
    .sort((a, b) => b.named - a.named);
}

// Every named party with the records that name it, most often first.
export function players(records) {
  const found = new Map();
  for (const record of records) {
    for (const key of Object.keys(LINKS)) {
      if (!record[key]) continue;
      const id = `${key}:${record[key].name}`;
      if (!found.has(id)) found.set(id, { id, kind: key, name: record[key].name, records: [] });
      found.get(id).records.push(record);
    }
  }
  return [...found.values()].sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name));
}

// filter.names is a LINKS key, 'nobody', or '' for everything. Every search word must appear somewhere.
export function matches(record, filter) {
  if (filter.city && !record.cities.includes(filter.city)) return false;
  if (filter.names === 'nobody' && Object.keys(LINKS).some(key => record[key])) return false;
  if (LINKS[filter.names] && !record[filter.names]) return false;
  const haystack = normalize([record.company, ...record.cities, ...(record.states || []), record.summary, record.source.publisher,
    ...Object.keys(LINKS).map(key => record[key]?.name)].join(' ')).toLowerCase();
  return normalize(filter.query).toLowerCase().split(' ').filter(Boolean).every(word => haystack.includes(word));
}

// ---------- Reading a new source with AI ----------

export const MAX_SOURCE = 12000;

export function extractionPrompt(text) {
  return `You are reading one source about a company-owned centre in India: a global capability centre (GCC), tech hub, R&D centre or business services centre.

Take only what the text itself says. Use no outside knowledge. Never guess.

Reply with only a JSON object in exactly this shape:
{"company": string, "city": string, "event": "opened" | "announced" | "expanded" | "leased", "summary": string, "receipt": string,
 "partner": {"name": string, "role": string, "quote": string} | null,
 "workplace": {"name": string, "role": string, "quote": string} | null,
 "government": {"name": string, "role": string, "quote": string} | null,
 "hiring": {"claim": string, "quote": string} | null}

Rules:
- "receipt" is the one sentence that says which company has a centre in which city.
- "receipt" and every "quote" must be ONE sentence copied from the text exactly, character for character. A program checks each one against the text and throws away any that is not there.
- "summary" is one plain sentence of at most 25 words.
- partner: an OUTSIDE firm the text names as helping set up, build or run the centre, such as an adviser, an IT services firm or a build-and-operate partner. Not a part of the company itself. Not a commentator or a data provider.
- workplace: a named building, business park, landlord or workspace operator. A district or neighbourhood alone does not count.
- government: a state government, agency, minister or chief minister the text names as involved, through an agreement, an inauguration or a statement.
- hiring: the headcount the text gives, now or planned. Say in "claim" whether it is current or a plan.
- "role" is a few plain words on what that party did.
- Use null for anything the text does not say.
- If the text is not about such a centre, reply {"company": null}.

Source text:
"""
${text}
"""`;
}

// Turns an AI reply into a record, keeping only what the source text backs up word for word.
// Returns { record, dropped } or { error }.
export function checkExtraction(reply, sourceText) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return { error: 'The reply was not in the expected form.' };
  if (!reply.company) return { error: 'This text does not seem to be about a company-owned centre in India.' };
  const text = value => typeof value === 'string' ? value.trim() : '';
  if (!quoteFound(sourceText, reply.receipt)) return { error: `The sentence offered as proof for ${text(reply.company)} is not in the text, so nothing was kept.` };
  const record = {
    company: text(reply.company), cities: [text(reply.city) || 'City not stated'],
    event: Object.hasOwn(EVENTS, reply.event) ? reply.event : 'announced',
    summary: text(reply.summary), receipt: normalize(reply.receipt)
  };
  const dropped = [];
  for (const key of [...Object.keys(LINKS), 'hiring']) {
    const part = reply[key];
    if (!part || typeof part !== 'object') continue;
    const label = key === 'hiring' ? text(part.claim) : text(part.name);
    if (!label) continue;
    if (!quoteFound(sourceText, part.quote)) { dropped.push({ key, label, quote: text(part.quote) }); continue; }
    record[key] = key === 'hiring' ? { claim: label, quote: normalize(part.quote) } : { name: label, role: text(part.role), quote: normalize(part.quote) };
  }
  return { record, dropped };
}

// ---------- Cost sketch ----------

// Salaries are the median software engineer pay Flexiple publishes for each city, in ₹ lakh a year.
// Everything else in the sketch is an example the reader is expected to change.
export const SALARY_SOURCE = { name: 'Flexiple, India GCC statistics', asOf: 'Aug 2026', url: 'https://flexiple.com/gcc/statistics' };
export const CITIES = [
  { id: 'bengaluru', name: 'Bengaluru', salary: 15.7 },
  { id: 'delhi', name: 'Delhi', salary: 14.1 },
  { id: 'hyderabad', name: 'Hyderabad', salary: 10.4 },
  { id: 'mumbai', name: 'Mumbai', salary: 9.7 },
  { id: 'pune', name: 'Pune', salary: 9.5 },
  { id: 'chennai', name: 'Chennai', salary: 7.6 }
];
// desks = desks for every 100 people; it is saved as seatRatio (0.6 = 60 desks).
export const LIMITS = { team: [5, 2000], salary: [1, 100], desk: [1000, 100000], overhead: [0, 100], desks: [10, 100] };

export function defaultState() {
  return { team: 40, overhead: 20, seatRatio: 0.6, desk: 10000, salaries: Object.fromEntries(CITIES.map(city => [city.id, city.salary])) };
}

// Takes anything (a saved plan, a half-edited one) and returns a usable plan:
// numbers are pulled into range and rounded, everything else falls back to the default.
export function normalizeState(value) {
  const state = defaultState();
  if (!value || typeof value !== 'object') return state;
  const number = (n, [min, max], fallback, decimals = 0) =>
    typeof n === 'number' && Number.isFinite(n) ? Number(Math.min(max, Math.max(min, n)).toFixed(decimals)) : fallback;
  state.team = number(value.team, LIMITS.team, state.team);
  state.overhead = number(value.overhead, LIMITS.overhead, state.overhead);
  state.desk = number(value.desk, LIMITS.desk, state.desk);
  if (typeof value.seatRatio === 'number') state.seatRatio = number(value.seatRatio * 100, LIMITS.desks, state.seatRatio * 100) / 100;
  for (const city of CITIES) state.salaries[city.id] = number(value.salaries?.[city.id], LIMITS.salary, city.salary, 1);
  return state;
}

// One city's yearly cost in whole rupees.
export function costs(cityId, state) {
  const salary = Math.round(state.team * state.salaries[cityId] * 100000);
  const overhead = Math.round(salary * state.overhead / 100);
  // Count in whole desks per 100 people: 100 * 0.55 is 55.00000000000001, which would round up to 56 desks.
  const seats = Math.ceil(state.team * Math.round(state.seatRatio * 100) / 100);
  const office = seats * state.desk * 12;
  const total = salary + overhead + office;
  return { salary, overhead, seats, office, total, perPerson: total / state.team };
}

// Cities from the lowest yearly cost to the highest.
export function rankCities(state) {
  return CITIES.map(city => ({ ...city, costs: costs(city.id, state) })).sort((a, b) => a.costs.total - b.costs.total);
}

const names = cities => new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(cities.map(city => city.name));

// One sentence on what the sketch shows.
export function costVerdict(state, ranked) {
  const lowest = ranked[0].costs.total;
  const highest = ranked.at(-1).costs.total;
  if (highest === lowest) return `Every city comes to ${money(lowest)} a year for ${state.team} people with these numbers.`;
  const cheapest = ranked.filter(city => city.costs.total === lowest);
  const dearest = ranked.filter(city => city.costs.total === highest);
  return `${names(cheapest)} ${cheapest.length === 1 ? 'comes' : 'come'} out lowest at ${money(lowest)} a year for ${state.team} people, ${money(highest - lowest)} less than ${names(dearest)}.`;
}

// ---------- Formatting ----------

const grouped = (value, decimals) => value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const rupees = value => `₹${grouped(Math.round(value), 0)}`;
const UNITS = { lakh: 100000, crore: 10000000 };
// The unit a figure reads best in. It switches where the rounded figure would read 100.00 lakh.
export const unitOf = value => value >= 9995000 ? 'crore' : 'lakh';
// ₹22.38 crore, ₹18.65 lakh, ₹50,400. Pass a unit to keep a list of figures in one unit: ₹0.78 crore.
export function money(value, decimals = 2, unit) {
  if (!unit && value < UNITS.lakh) return rupees(value);
  unit ??= unitOf(value);
  return `₹${grouped(value / UNITS[unit], decimals)} ${unit}`;
}
// '2021-07-19' -> 19 Jul 2021
export const formatDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
