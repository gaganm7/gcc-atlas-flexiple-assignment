import { evidence } from './evidence.js';
import { CITIES, EVENTS, KINDS, LIMITS, LINKS, MAX_SOURCE, SALARY_SOURCE, UNNAMED, checkExtraction, costVerdict, costs, coverage, defaultState, extractionPrompt, formatDate, matches, money, normalize, normalizeState, players, rankCities } from './model.js';
import { buildReport, findingSentence, toHtml, toMarkdown, escapeHtml } from './report.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const PLAN_KEY = 'gcc-compass-plan-v2';
const ADDED_KEY = 'gcc-compass-added-v1';
const records = evidence.records;
const checkedOn = formatDate(evidence.checkedOn);

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The page still works when storage is blocked. */ }
}
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

// Inside Claude the page can ask Claude to read a source and can hand over a file. Anywhere else both are absent.
const inClaude = Boolean(window.claude?.use);
const capability = name => inClaude ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
const ai = capability('sample');
const downloads = capability('downloads');

let plan = normalizeState(load(PLAN_KEY));
let added = cleanAdded(load(ADDED_KEY));
const PREVIEW = 8;    // entries listed before "Show all"
let showAll = false;
let reading = null;   // AbortController of the read in progress
let result = null;    // the last source read: { record, dropped, url }

// ---------- The record ----------

const listed = values => values.join(', ');

function proof(label, name, role, quote) {
  return `<div><dt>${label}${name ? ` <strong>${escapeHtml(name)}</strong>` : ''}${role ? ` <span>${escapeHtml(role)}</span>` : ''}</dt><dd>${escapeHtml(quote)}</dd></div>`;
}
// What a source proves, shared by the record and by a source that was just read.
function proofList(record) {
  const named = Object.keys(LINKS).filter(key => record[key]);
  const missing = [...Object.keys(LINKS).filter(key => !record[key]).map(key => LINKS[key].label.toLowerCase()), ...UNNAMED.map(name => name.toLowerCase())];
  return `<dl class="proof">
      ${named.map(key => proof(LINKS[key].label, record[key].name, record[key].role, record[key].quote)).join('')}
      ${proof('The centre', '', '', record.receipt)}
      ${record.hiring ? proof('Hiring', record.hiring.claim, '', record.hiring.quote) : ''}
    </dl>
    <p class="unnamed">Not named in this source: ${listed(missing)}.</p>`;
}
function entry(record, mine = false) {
  const named = Object.keys(LINKS).filter(key => record[key]);
  const when = mine ? `added ${formatDate(record.addedOn)}` : record.publishedOn ? formatDate(record.publishedOn) : 'no date on the page';
  const chips = named.length
    ? named.map(key => `<span class="chip">${record[key].name.startsWith(LINKS[key].label) ? '' : LINKS[key].label + ': '}${escapeHtml(record[key].name)}</span>`).join('')
    : '<span class="chip none">Nobody else named</span>';
  const url = mine ? safeUrl(record.url) : record.source.url;
  const check = mine ? 'Quotes checked against the text you pasted. The source itself has not been checked.'
    : record.check === 'matched' ? `Quotes copied from the live page and matched on ${checkedOn}.` : record.checkNote;
  const source = mine
    ? (url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Source you gave <span aria-hidden="true">↗</span></a>` : 'No source link given')
    : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.source.title)} <span aria-hidden="true">↗</span></a> · ${escapeHtml(record.source.publisher)} · ${KINDS[record.source.kind]}`;
  return `<details class="entry" id="${escapeHtml(record.id)}">
    <summary><span class="entry-info">
      <span class="entry-name">${escapeHtml(record.company)}</span>
      <span class="entry-place">${escapeHtml(listed(record.cities))} · ${EVENTS[record.event]} · ${when}</span>
      <span class="chips">${mine ? '<span class="chip mine">Added by you</span>' : ''}${chips}</span>
    </span></summary>
    <div class="entry-body">
      ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}
      ${proofList(record)}
      <p class="source">${source}</p>
      <p class="check">${escapeHtml(check)}</p>
      ${mine ? `<button type="button" class="link" data-remove="${escapeHtml(record.id)}">Remove this entry</button>` : ''}
    </div>
  </details>`;
}

function buildFinding() {
  const rows = coverage(records);
  const total = records.length;
  $('#finding-lede').textContent = findingSentence(records);
  $('#coverage').innerHTML = [
    ...rows.map(row => `<button type="button" class="meter" data-names="${row.key}" title="${escapeHtml(row.help)}">
      <span class="meter-label">${row.label}</span>
      <span class="meter-track"><span class="meter-fill" style="width:${(row.named / total * 100).toFixed(1)}%"></span></span>
      <span class="meter-value">${row.named} of ${total}</span></button>`),
    ...UNNAMED.map(name => `<div class="meter">
      <span class="meter-label">${name}</span><span class="meter-track"></span><span class="meter-value">0 of ${total}</span></div>`)
  ].join('');
  const groups = Object.fromEntries(Object.keys(LINKS).map(key => [key, []]));
  for (const player of players(records)) groups[player.kind].push(player);
  $('#players').innerHTML = coverage(records).map(row => `<div class="player-group"><h3>${row.label}s named</h3><div class="chips">${
    groups[row.key].map(player => `<button type="button" class="chip pick" data-player="${escapeHtml(player.name)}">${escapeHtml(player.name)} <b>${player.records.length}</b></button>`).join('')
  }</div></div>`).join('');
}

function buildRecord() {
  $('#record-list').innerHTML = records.map(record => entry(record)).join('');
  const cities = [...new Set(records.flatMap(record => record.cities))].sort();
  $('#filter-city').insertAdjacentHTML('beforeend', cities.map(city => `<option>${escapeHtml(city)}</option>`).join(''));
  $('#filter-names').insertAdjacentHTML('beforeend', Object.entries(LINKS).map(([key, link]) => `<option value="${key}">Names ${link.one}</option>`).join('') + '<option value="nobody">Names nobody else</option>');
}
function renderAdded() {
  $('#added-list').innerHTML = added.map(record => entry(record, true)).join('');
  $('#added').hidden = !added.length;
}
// With no filter set the list opens on its first few entries, so the page is not one long scroll.
function applyFilter() {
  const filter = { query: $('#filter-query').value, city: $('#filter-city').value, names: $('#filter-names').value };
  const whole = showAll || Boolean(filter.query.trim() || filter.city || filter.names);
  let matched = 0;
  let shown = 0;
  for (const record of records) {
    const row = document.getElementById(record.id);
    if (matches(record, filter)) matched += 1; else { row.hidden = true; continue; }
    row.hidden = !whole && matched > PREVIEW;
    if (!row.hidden) shown += 1;
  }
  $('#record-count').textContent = `${shown} of ${records.length} shown`;
  $('#show-all').hidden = whole;
  $('#no-records').hidden = matched > 0;
}
function showFiltered(change) {
  $('#filter-query').value = change.query ?? '';
  $('#filter-city').value = '';
  $('#filter-names').value = change.names ?? '';
  applyFilter();
  $('#record').scrollIntoView({ block: 'start' });
  $('#record-title').focus({ preventScroll: true });
}

// Whatever sits in storage is checked again before it is shown.
function cleanAdded(value) {
  if (!Array.isArray(value)) return [];
  const text = item => typeof item === 'string' ? item.slice(0, 700) : '';
  return value.slice(0, 20).filter(item => item && typeof item === 'object' && text(item.company) && text(item.receipt)).map((item, index) => {
    const record = {
      id: `mine-${index}`, company: text(item.company), cities: (Array.isArray(item.cities) ? item.cities : []).map(text).filter(Boolean).slice(0, 3),
      event: Object.hasOwn(EVENTS, item.event) ? item.event : 'announced', summary: text(item.summary), receipt: text(item.receipt),
      url: safeUrl(item.url), addedOn: /^\d{4}-\d{2}-\d{2}$/.test(item.addedOn) ? item.addedOn : evidence.checkedOn
    };
    for (const key of Object.keys(LINKS)) if (item[key] && text(item[key].name) && text(item[key].quote)) record[key] = { name: text(item[key].name), role: text(item[key].role), quote: text(item[key].quote) };
    if (item.hiring && text(item.hiring.claim) && text(item.hiring.quote)) record.hiring = { claim: text(item.hiring.claim), quote: text(item.hiring.quote) };
    return record;
  });
}

// ---------- Reading a new source ----------

const READ_ERRORS = {
  not_granted: 'Claude was not allowed for this page, so live reading is off. The samples still show a saved answer.',
  sampling_disabled: 'Claude is not available for this account, so live reading is off. The samples still show a saved answer.',
  rate_limited: 'Claude is busy, or your usage limit is reached. Try again later.',
  session_expired: 'Sign in to Claude again, then retry.',
  refused: 'Claude declined to read this text.',
  prompt_too_large: 'That text is too long. Paste the main part of the announcement.'
};
function setStatus(message) { $('#reader-status').textContent = message; }

async function readSource() {
  const text = $('#source-text').value.trim();
  if (reading) { reading.abort(); return; }
  $('#reader-result').hidden = true;
  if (text.length < 80) return setStatus('Paste the announcement first: at least a few sentences.');
  if (text.length > MAX_SOURCE) return setStatus(`That is too long. Paste up to ${MAX_SOURCE.toLocaleString('en-IN')} characters: the main part of the announcement.`);
  const sample = evidence.samples.find(item => normalize(item.text) === normalize(text));
  setStatus('Checking whether Claude is connected…');
  const live = await ai;
  setStatus('');
  let reply;
  let origin;
  if (live) {
    reading = new AbortController();
    $('#read-source').textContent = 'Stop';
    setStatus('Claude is reading the text…');
    try {
      reply = await live.json(extractionPrompt(text), { modelTier: 'quick', signal: reading.signal });
      origin = 'Read by Claude just now.';
    } catch (error) {
      setStatus(error?.code === 'cancelled' ? 'Stopped.' : READ_ERRORS[error?.code] || 'The reply could not be read. Try again.');
      if (!sample || error?.code === 'cancelled') return;
    } finally {
      reading = null;
      $('#read-source').textContent = 'Read it';
    }
  }
  if (!reply && sample) { reply = sample.saved; origin = 'Saved answer for this sample. Live reading runs when the page is opened inside Claude.'; }
  if (!reply) return setStatus('Live reading needs Claude: open this page inside Claude and allow it. Here, the three samples show a saved answer.');
  showResult(checkExtraction(reply, text), origin);
}

function showResult(checked, origin) {
  const box = $('#reader-result');
  box.hidden = false;
  if (checked.error) { result = null; setStatus(''); box.innerHTML = `<p class="result-error">${escapeHtml(checked.error)}</p>`; return; }
  const { record, dropped } = checked;
  result = { record, url: safeUrl($('#source-url').value.trim()) };
  const kept = 1 + Object.keys(LINKS).filter(key => record[key]).length + (record.hiring ? 1 : 0);
  setStatus('');
  box.innerHTML = `<p class="result-origin">${escapeHtml(origin)}</p>
    <h3>${escapeHtml(record.company)} <span>${escapeHtml(listed(record.cities))} · ${EVENTS[record.event]}</span></h3>
    ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}
    <p class="result-check"><strong>${kept} of ${kept + dropped.length} quotes found in your text, word for word.</strong>${dropped.length ? ' The rest were dropped.' : ''}</p>
    ${proofList(record)}
    ${dropped.length ? `<ul class="dropped">${dropped.map(item => `<li><strong>${item.key === 'hiring' ? 'Hiring' : LINKS[item.key].label}: ${escapeHtml(item.label)}</strong> was dropped. This sentence is not in the text: ${escapeHtml(item.quote || 'no quote was given')}</li>`).join('')}</ul>` : ''}
    <p class="result-actions"><button type="button" class="button" id="add-result">Add to the record</button> <span>Saved in this browser only.</span></p>`;
  box.scrollIntoView({ block: 'nearest' });
}

function addResult() {
  if (!result) return;
  const today = new Date();
  const addedOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  added = cleanAdded([{ ...result.record, url: result.url, addedOn }, ...added]);
  save(ADDED_KEY, added);
  renderAdded();
  result = null;
  $('#reader-result').hidden = true;
  setStatus('Added. It is at the top of the record, marked as yours.');
  const row = $('#added-list .entry');
  row.open = true;
  row.scrollIntoView({ block: 'center' });
  $('summary', row).focus({ preventScroll: true });
}

// ---------- Cost sketch ----------

// Every control is named after the part of the plan it edits: team, desk, overhead, desks (saved as seatRatio), salary.<city>.
function read(name) {
  const [key, city] = name.split('.');
  if (city) return plan.salaries[city];
  return key === 'desks' ? Math.round(plan.seatRatio * 100) : plan[key];
}
function write(name, value) {
  const [key, city] = name.split('.');
  if (city) plan.salaries[city] = value;
  else if (key === 'desks') plan.seatRatio = value / 100;
  else plan[key] = value;
  plan = normalizeState(plan);
  save(PLAN_KEY, plan);
  renderCost();
}
function fillForm() {
  for (const control of $$('#cost input[name]')) control.value = read(control.name);
}
// Built once, in a fixed order, so typing a salary never moves the row being edited.
function buildCost() {
  $('#cost-rows').innerHTML = CITIES.map(city => `<tr data-city="${city.id}">
    <th scope="row">${city.name}</th>
    <td><input id="salary-${city.id}" type="number" name="salary.${city.id}" step="0.1" inputmode="decimal" required aria-label="${city.name}: salary per person, ₹ lakh a year"></td>
    <td class="cost-total"><span class="cost-bar"><span></span></span><output></output><small></small></td>
    <td class="cost-person"></td>
  </tr>`).join('');
  for (const input of $$('#cost input[type=number]')) { [input.min, input.max] = LIMITS[input.name.split('.')[0]]; }
  $('#team-range').textContent = LIMITS.team.map(limit => limit.toLocaleString('en-IN')).join(' to ');
  $('#salary-source').innerHTML = `<a href="${SALARY_SOURCE.url}" target="_blank" rel="noopener noreferrer">${SALARY_SOURCE.name} <span aria-hidden="true">↗</span></a>, as of ${SALARY_SOURCE.asOf}`;
}
function renderCost() {
  const ranked = rankCities(plan);
  const highest = ranked.at(-1).costs.total;
  $('#cost-verdict').textContent = costVerdict(plan, ranked);
  $('#cost-summary').textContent = `${plan.team} people`;
  for (const row of $$('#cost-rows tr')) {
    const cost = costs(row.dataset.city, plan);
    $('.cost-bar span', row).style.width = `${(cost.total / highest * 100).toFixed(1)}%`;
    $('output', row).textContent = money(cost.total);
    $('.cost-person', row).textContent = money(cost.perPerson);
    $('small', row).textContent = `${money(cost.perPerson)} per person`;
    row.classList.toggle('lowest', cost.total === ranked[0].costs.total);
  }
  $('#cost-desks').textContent = `${costs(CITIES[0].id, plan).seats} desks`;
  for (const preset of $$('[data-team]')) preset.setAttribute('aria-pressed', Number(preset.dataset.team) === plan.team);
}

// ---------- Taking it away ----------

const reportMarkdown = () => toMarkdown(buildReport(evidence));
async function copyReport() {
  const note = $('#save-note');
  try {
    await navigator.clipboard.writeText(reportMarkdown());
    note.textContent = 'Copied. Paste it into a document or a message.';
  } catch {
    const fallback = $('#copy-fallback');
    fallback.hidden = false;
    fallback.value = reportMarkdown();
    fallback.select();
    note.textContent = 'Copying was blocked. The text is selected below: copy it from there.';
  }
}
async function downloadReport() {
  const note = $('#save-note');
  const viaClaude = await downloads;
  if (viaClaude) {
    try { await viaClaude.save({ filename: 'gcc-compass-record.md', data: reportMarkdown() }); note.textContent = 'Saved.'; }
    catch (error) { note.textContent = error?.code === 'declined' ? '' : 'The file could not be saved here. Use Copy instead.'; }
    return;
  }
  const url = URL.createObjectURL(new Blob([reportMarkdown()], { type: 'text/markdown;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'gcc-compass-record.md' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Wiring ----------

document.addEventListener('input', event => {
  const control = event.target;
  if (control.closest('.filters')) applyFilter();
  else if (!control.name || !control.closest('#cost')) return;
  // A half-typed or out-of-range number waits; the sketch keeps the last usable value.
  else if (control.value !== '' && control.validity.valid) write(control.name, control.valueAsNumber);
});
// Leaving a number field settles it: out of range is pulled into range, empty goes back to the last value.
document.addEventListener('change', event => {
  const control = event.target;
  if (control.type !== 'number' || !control.closest('#cost')) return;
  if (!Number.isNaN(control.valueAsNumber)) write(control.name, control.valueAsNumber);
  fillForm();
});
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.names) showFiltered({ names: data.names });
  else if (data.player) showFiltered({ query: data.player });
  else if (data.team) { write('team', Number(data.team)); fillForm(); }
  else if (data.sample) {
    const sample = evidence.samples.find(item => item.id === data.sample);
    $('#source-text').value = sample.text;
    $('#source-url').value = sample.url;
    $('#reader-result').hidden = true;
    setStatus('Sample loaded. Now read it.');
  } else if (data.remove) {
    added = cleanAdded(added.filter(record => record.id !== data.remove));
    save(ADDED_KEY, added);
    renderAdded();
  } else if (button.id === 'add-result') addResult();
});
$('#read-source').addEventListener('click', readSource);
$('#clear-filters').addEventListener('click', () => showFiltered({}));
$('#show-all').addEventListener('click', () => { showAll = true; applyFilter(); });
$('#reset').addEventListener('click', () => { plan = defaultState(); save(PLAN_KEY, plan); fillForm(); renderCost(); });
$('#copy').addEventListener('click', copyReport);
$('#download').addEventListener('click', downloadReport);
$('#print').addEventListener('click', () => window.print());

buildFinding();
buildRecord();
buildCost();
renderAdded();
applyFilter();
fillForm();
renderCost();
$('#samples').innerHTML = evidence.samples.map(sample => `<button type="button" class="chip pick" data-sample="${escapeHtml(sample.id)}">${escapeHtml(sample.label)}</button>`).join('');
$('#report').innerHTML = toHtml(buildReport(evidence));
$('#show-all').textContent = `Show all ${records.length}`;
for (const slot of $$('[data-fill]')) slot.textContent = { records: records.length, sources: new Set(records.map(record => record.source.url)).size, checked: checkedOn, max: MAX_SOURCE.toLocaleString('en-IN') }[slot.dataset.fill];
// Printing and plain downloads are refused inside Claude; there the page saves through Claude instead.
$('#print').hidden = inClaude;
ai.then(live => { $('#reader-mode').textContent = live ? 'Live: Claude reads whatever you paste.' : 'Claude is not connected here, so the three samples show a saved answer.'; });
downloads.then(viaClaude => { $('#download').hidden = inClaude && !viaClaude; });
