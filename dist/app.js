import { evidence } from './evidence.js';
import { CITIES, EVENTS, KINDS, LIMITS, LINKS, SALARY_SOURCE, checkExtraction, costVerdict, costs, coverage, defaultState, formatDate, matches, money, normalizeState, players, rankCities } from './model.js';
import { buildReport, findingSentence, toHtml, toMarkdown, escapeHtml } from './report.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const PLAN_KEY = 'gcc-compass-plan-v2';
const records = evidence.records;
const checkedOn = formatDate(evidence.checkedOn);

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The page still works when storage is blocked. */ }
}
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };

// Saved research demonstrations never call a model. The optional host capability only saves downloads.
const inClaude = Boolean(window.claude?.use);
const capability = name => inClaude ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
const downloads = capability('downloads');

let plan = normalizeState(load(PLAN_KEY));
const PREVIEW = 8;    // entries listed before "Show all"
let showAll = false;

// ---------- The record ----------

const listed = values => values.join(', ');

function proof(label, name, role, quote) {
  return `<div><dt>${label}${name ? ` <strong>${escapeHtml(name)}</strong>` : ''}${role ? ` <span>${escapeHtml(role)}</span>` : ''}</dt><dd>${escapeHtml(quote)}</dd></div>`;
}
// Recorded relationships, shared by the curated record and the saved research demonstrations.
function proofList(record) {
  const named = Object.keys(LINKS).filter(key => record[key]);
  const missing = Object.keys(LINKS).filter(key => !record[key]).map(key => LINKS[key].label.toLowerCase());
  return `<dl class="proof">
      ${named.map(key => proof(LINKS[key].label, record[key].name, record[key].role, record[key].quote)).join('')}
      ${proof('The centre', '', '', record.receipt)}
      ${record.hiring ? proof('Hiring', record.hiring.claim, '', record.hiring.quote) : ''}
    </dl>
    <p class="unnamed">${missing.length ? `No recorded relationship in these categories: ${listed(missing)}.` : 'All three tracked relationship types are recorded.'} Other parties may be mentioned; involvement does not establish quality.</p>`;
}
function entry(record) {
  const named = Object.keys(LINKS).filter(key => record[key]);
  const when = record.publishedOn ? formatDate(record.publishedOn) : 'no date on the page';
  const chips = named.length
    ? named.map(key => `<span class="chip">${record[key].name.startsWith(LINKS[key].label) ? '' : LINKS[key].label + ': '}${escapeHtml(record[key].name)}</span>`).join('')
    : '<span class="chip none">No tracked relationship</span>';
  const check = record.check === 'matched' ? `Quotes matched to the source snapshot checked on ${checkedOn}.` : record.checkNote;
  return `<details class="entry" id="${escapeHtml(record.id)}">
    <summary><span class="entry-info">
      <span class="entry-name">${escapeHtml(record.company)}</span>
      <span class="entry-place">${escapeHtml(listed(record.cities))} · ${EVENTS[record.event]} · ${when}</span>
      <span class="chips">${chips}</span>
    </span></summary>
    <div class="entry-body">
      ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}
      ${proofList(record)}
      <p class="source"><a href="${escapeHtml(record.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.source.title)} <span aria-hidden="true">↗</span></a> · ${escapeHtml(record.source.publisher)} · ${KINDS[record.source.kind]}</p>
      <p class="check">${escapeHtml(check)}</p>
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
      <span class="meter-value">${row.named} of ${total}</span></button>`)
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
  $('#filter-names').insertAdjacentHTML('beforeend', Object.entries(LINKS).map(([key, link]) => `<option value="${key}">Names ${link.one}</option>`).join('') + '<option value="nobody">No tracked relationship</option>');
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

// ---------- Saved research demonstrations ----------

function showSample(sample) {
  if (!sample) return;
  for (const button of $$('[data-sample]')) button.setAttribute('aria-pressed', String(button.dataset.sample === sample.id));
  $('#sample-details').hidden = false;
  $('#sample-title').textContent = sample.title;
  const sourceLink = $('#sample-source');
  sourceLink.href = safeUrl(sample.url);
  sourceLink.textContent = 'Open the original source';
  $('#sample-text').innerHTML = sample.text.split(/\n\n+/).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const checked = checkExtraction(sample.saved, sample.text);
  const box = $('#reader-result');
  box.hidden = false;
  if (checked.error) {
    $('#reader-status').textContent = 'This saved demonstration failed the quote check.';
    box.innerHTML = `<p class="result-error">${escapeHtml(checked.error)}</p>`;
    return;
  }
  const { record, dropped } = checked;
  const kept = 1 + Object.keys(LINKS).filter(key => record[key]).length + (record.hiring ? 1 : 0);
  $('#reader-status').textContent = 'Saved demonstration checked against its excerpt.';
  box.innerHTML = `<p class="result-origin">Saved demonstration from the checked record; no model was called.</p>
    <h3>${escapeHtml(record.company)} <span>${escapeHtml(listed(record.cities))} · ${EVENTS[record.event]}</span></h3>
    ${record.summary ? `<p>${escapeHtml(record.summary)}</p>` : ''}
    <p class="result-check"><strong>${kept} of ${kept + dropped.length} quotes found in this saved excerpt, word for word.</strong>${dropped.length ? ' The rest were dropped.' : ''}</p>
    ${proofList(record)}
    ${dropped.length ? `<ul class="dropped">${dropped.map(item => `<li><strong>${item.key === 'hiring' ? 'Hiring' : LINKS[item.key].label}: ${escapeHtml(item.label)}</strong> was dropped. This sentence is not in the excerpt: ${escapeHtml(item.quote || 'no quote was given')}</li>`).join('')}</ul>` : ''}`;
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
  else if (data.sample) showSample(evidence.samples.find(item => item.id === data.sample));
});
$('#clear-filters').addEventListener('click', () => showFiltered({}));
$('#show-all').addEventListener('click', () => { showAll = true; applyFilter(); });
$('#reset').addEventListener('click', () => { plan = defaultState(); save(PLAN_KEY, plan); fillForm(); renderCost(); });
$('#copy').addEventListener('click', copyReport);
$('#download').addEventListener('click', downloadReport);
$('#print').addEventListener('click', () => window.print());

buildFinding();
buildRecord();
buildCost();
applyFilter();
fillForm();
renderCost();
$('#samples').innerHTML = evidence.samples.map(sample => `<button type="button" class="chip pick" data-sample="${escapeHtml(sample.id)}" aria-pressed="false">${escapeHtml(sample.label)}</button>`).join('');
$('#report').innerHTML = toHtml(buildReport(evidence));
$('#show-all').textContent = `Show all ${records.length}`;
for (const slot of $$('[data-fill]')) slot.textContent = { records: records.length, sources: new Set(records.map(record => record.source.url)).size, checked: checkedOn }[slot.dataset.fill];
// Printing and plain downloads are refused inside Claude; there the page saves through Claude instead.
$('#print').hidden = inClaude;
downloads.then(viaClaude => { $('#download').hidden = inClaude && !viaClaude; });
