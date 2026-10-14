import { evidence } from './evidence.js';
import { EVENTS, KINDS, money, unitOf, formatDate } from './model.js';
import { ATLAS_CITIES, CRITERIA, FUNCTIONS, ATLAS_METHODOLOGY, BUDGET_SCOPES, BENCHMARK_SOURCE, COST_SOURCES, defaultAtlasPlan, customerAtlasPlan, evaluateAtlas } from './atlas-model.js';
import { ATLAS_PROVIDERS, ATLAS_DATA_CHECKED_ON } from './atlas-data.js';

const atlas$ = selector => document.querySelector(selector);
const atlasAll = selector => [...document.querySelectorAll(selector)];
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const external = (url, label) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(label)}</a>`;
const STORAGE_PLAN = 'gcc-atlas-plan-v1', STORAGE_SAVED = 'gcc-atlas-decisions-v1', STORAGE_PROVIDERS = 'gcc-atlas-providers-v1';
const CATEGORY_NAMES = { setup: 'GCC setup & operations', legal: 'Legal & entity setup', tax: 'Tax, audit & compliance', talent: 'Recruitment & talent', payroll: 'Payroll & EOR', property: 'Office space' };
const PAGE_NAMES = { decision: 'Compare cities', companies: 'Company evidence', providers: 'Find services', saved: 'Saved plans' };
const textDate = value => value ? formatDate(value) : 'Date not stated';
const checkedLabel = record => record.check === 'matched' ? 'Quote matched to source' : 'Read once; not automatically rechecked';
const currentDate = () => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
let atlasPlan = customerAtlasPlan(readStored(STORAGE_PLAN, null));
function cleanProviderIds(value) { return Array.isArray(value) ? [...new Set(value.filter(id => ATLAS_PROVIDERS.some(provider => provider.id === id)))] : []; }
let shortlistedProviderIds = cleanProviderIds(readStored(STORAGE_PROVIDERS, []));
let savedDecisions = readStored(STORAGE_SAVED, []);
if (!Array.isArray(savedDecisions)) savedDecisions = [];
savedDecisions = savedDecisions.filter(item => item && typeof item.id === 'string' && item.plan && typeof item.createdAt === 'string').map(item => ({ id: item.id, createdAt: item.createdAt, plan: customerAtlasPlan(item.plan), providerIds: cleanProviderIds(item.providerIds) })).slice(0, 50);
let atlasPage = 'decision', atlasTimer;
let storageAvailable = true;
function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { storageAvailable = false; return false; } }
function atlasToast(message) { clearTimeout(atlasTimer); atlas$('#atlas-toast').textContent = message; atlas$('#atlas-toast').hidden = false; atlasTimer = setTimeout(() => { atlas$('#atlas-toast').hidden = true; }, 3800); }
function setAtlasPage(page, scroll = true, updateHistory = true) {
  atlasPage = Object.hasOwn(PAGE_NAMES, page) ? page : 'decision';
  atlasAll('.atlas-view').forEach(view => { view.hidden = view.id !== `atlas-view-${atlasPage}`; });
  atlasAll('.planner-nav [data-page]').forEach(button => { const selected = button.dataset.page === atlasPage; button.classList.toggle('selected', selected); if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  document.title = `${PAGE_NAMES[atlasPage]} | GCC Atlas`;
  if (updateHistory && location.hash !== `#${atlasPage}`) history.pushState(null, '', `#${atlasPage}`);
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
// These tags are editorial search aids inferred from the words in the existing source record.
// The UI labels that distinction; absence of a tag is not absence of the capability.
function inferredTags(text) {
  const terms = text.toLowerCase();
  const sectors = [['Financial services', /bank|insurance|financ|payments|fintech/], ['Healthcare', /medical|pharma|health|medicine/], ['Energy', /\boil\b|\bgas\b|energy/], ['Retail & consumer', /retail|consumer|fashion|beverage|beer/], ['Engineering & industrial', /manufactur|automotive|industrial|wind|turbine/], ['Technology', /software|technology|\btech\b|digital|cloud/]];
  const functions = [['technology', /software|technology|\btech\b|digital|cloud|data|analytics|\bai\b/], ['engineering', /engineering|design|product development/], ['finance', /finance|financial|account|insurance|banking/], ['operations', /operations|business services|shared services|customer service|support/], ['research', /research|\br&d\b|innovation/]].filter(([, regex]) => regex.test(terms)).map(([id]) => id);
  return { sector: sectors.find(([, regex]) => regex.test(terms))?.[0] || 'Not recorded', functions };
}
const companyGroups = new Map();
for (const record of evidence.records) {
  if (!companyGroups.has(record.company)) companyGroups.set(record.company, { id: record.id, company: record.company, records: [], cities: [], functions: [], sector: 'Not recorded' });
  const group = companyGroups.get(record.company); group.records.push(record);
}
const atlasCompanies = [...companyGroups.values()].map(group => {
  group.cities = [...new Set(group.records.flatMap(record => record.cities))];
  group.records.sort((a, b) => (b.publishedOn || '').localeCompare(a.publishedOn || ''));
  const tags = inferredTags(group.records.map(record => `${record.summary} ${record.receipt}`).join(' '));
  return { ...group, ...tags, latest: group.records[0].publishedOn || '' };
});

function fillAtlasForm() {
  const plan = atlasPlan;
  atlas$('#atlas-functions').innerHTML = Object.entries(FUNCTIONS).map(([id, label]) => `<label><input type="checkbox" name="functions" value="${id}" ${plan.functions.includes(id) ? 'checked' : ''}>${label}</label>`).join('');
  atlas$('#atlas-city-options').innerHTML = ATLAS_CITIES.map(city => `<label><input type="checkbox" name="cities" value="${city.id}" ${plan.excludedCities.includes(city.id) ? '' : 'checked'}>${city.name}</label>`).join('');
  for (const [id, key] of [['atlas-headcount', 'headcount'], ['atlas-budget', 'budget'], ['atlas-budget-scope', 'budgetScope'], ['atlas-timeline', 'timeline'], ['atlas-priority', 'priority'], ['atlas-constraints', 'constraints']]) atlas$(`#${id}`).value = plan[key];
  atlas$('#atlas-scope-hint').textContent = BUDGET_SCOPES[plan.budgetScope].hint;
}
function syncAtlasForm(showErrors = false) {
  const form = atlas$('#atlas-plan-form');
  atlas$('#atlas-scope-hint').textContent = BUDGET_SCOPES[atlas$('#atlas-budget-scope').value]?.hint || '';
  const functions = atlasAll('#atlas-functions input:checked').map(input => input.value);
  const cities = atlasAll('#atlas-city-options input:checked').map(input => input.value);
  const invalid = [...form.querySelectorAll('input,select,textarea')].find(input => !input.validity.valid);
  let error = !functions.length ? 'Choose at least one type of work.' : !cities.length ? 'Include at least one city.' : invalid ? `Check ${invalid.getAttribute('aria-label') || invalid.closest('label')?.childNodes[0]?.textContent?.trim() || 'your number inputs'}. Use the allowed range and a complete number.` : '';
  if (error) {
    atlas$('#atlas-input-error').textContent = error;
    atlas$('#atlas-save').disabled = true; atlas$('#atlas-report').disabled = true;
    atlas$('#atlas-results').setAttribute('data-stale', 'true');
    if (showErrors && invalid) { invalid.closest('details')?.setAttribute('open', ''); invalid.reportValidity(); }
    return false;
  }
  atlasPlan = customerAtlasPlan({
    functions, excludedCities: ATLAS_CITIES.map(city => city.id).filter(id => !cities.includes(id)),
    headcount: Number(atlas$('#atlas-headcount').value), budget: Number(atlas$('#atlas-budget').value), budgetScope: atlas$('#atlas-budget-scope').value,
    timeline: Number(atlas$('#atlas-timeline').value), priority: atlas$('#atlas-priority').value, constraints: atlas$('#atlas-constraints').value
  });
  persist(STORAGE_PLAN, atlasPlan);
  atlas$('#atlas-input-error').textContent = ''; atlas$('#atlas-results').removeAttribute('data-stale');
  renderAtlasResults(); return true;
}
const budgetNote = city => city.budgetStatus.withinBudget ? 'within your budget' : `${money(-city.budgetStatus.difference)} over budget`;
const sentenceCase = text => text.charAt(0).toUpperCase() + text.slice(1);
// One row per cost line in the chosen scope. A detail shared by every city sits under the line's name.
function renderCostBreakdown(result) {
  const scope = BUDGET_SCOPES[atlasPlan.budgetScope], cities = result.ranked;
  atlas$('#atlas-cost-scope').textContent = `${scope.heading} for ${atlasPlan.headcount} people, ${atlasPlan.budgetScope === 'total' ? 'year one' : 'per year'}. Not included: ${scope.excluded}.`;
  atlas$('#atlas-cost-head').innerHTML = `<tr><th>Cost line</th>${cities.map(city => `<th>${city.name}</th>`).join('')}</tr>`;
  const rows = (cities[0]?.costLines || []).map((line, index) => {
    const cells = cities.map(city => city.costLines[index]), unit = unitOf(Math.max(...cells.map(cell => cell.amount)));
    const shared = cells.every(cell => cell.detail === line.detail);
    return `<tr><td>${safe(line.label)}<small>${safe(COST_SOURCES[line.source])}${shared ? ` · ${safe(line.detail)}` : ''}</small></td>${cells.map(cell => `<td><strong>${money(cell.amount, 2, unit)}</strong>${shared ? '' : `<small>${safe(cell.detail)}</small>`}</td>`).join('')}</tr>`;
  });
  const totalUnit = unitOf(Math.max(0, ...cities.map(city => city.budgetCost)));
  rows.push(`<tr><td><strong>${scope.heading}</strong><small>Your budget: ${money(result.budgetRupees)}</small></td>${cities.map(city => `<td><strong>${money(city.budgetCost, 2, totalUnit)}</strong><small>${sentenceCase(budgetNote(city))}</small></td>`).join('')}</tr>`);
  atlas$('#atlas-cost-body').innerHTML = rows.join('');
  const salary = ATLAS_CITIES[0].salarySource;
  atlas$('#atlas-cost-sources').innerHTML = [
    `Salaries: ${external(salary.url, salary.name)}, ${safe(salary.asOf)}. Software-engineer medians, not quotes for every role.`,
    atlasPlan.budgetScope === 'total' ? `Benchmarks: ${external(BENCHMARK_SOURCE.url, BENCHMARK_SOURCE.name)}, ${safe(BENCHMARK_SOURCE.asOf)}. Averages per person across more than 60 GCCs, not quotes.` : '',
    atlasPlan.budgetScope === 'salary' ? '' : 'Planning assumptions are GCC Atlas’s own; check them against your quotes.',
    'The cost rating uses salaries, benefits and office rent, so what your budget covers never changes the ranking.'
  ].filter(Boolean).join(' ');
}
function renderAtlasResults() {
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0], scope = BUDGET_SCOPES[atlasPlan.budgetScope];
  atlas$('#atlas-save').disabled = !lead; atlas$('#atlas-report').disabled = !lead;
  atlas$('#atlas-warnings').innerHTML = result.warnings.filter(warning => warning.kind !== 'assumptions').map(warning => `<div class="warning ${warning.kind.startsWith('budget') ? 'budget' : ''}">${safe(warning.message)}</div>`).join('');
  atlas$('#atlas-recommendation').innerHTML = lead ? `<strong>${lead.name} ranks first for your priorities.</strong><p>${atlasPlan.headcount} people · ${money(result.budgetRupees)} budget · ${atlasPlan.timeline}-month target. ${safe(result.scopeExplanation)}</p>` : '<strong>No ranking yet.</strong><p>Include at least one city to see a ranking.</p>';
  atlas$('#atlas-city-grid').innerHTML = result.ranked.map((city, index) => `<article class="result-card ${index === 0 ? 'lead' : ''}" data-atlas-city="${city.id}"><header><span>OPTION ${index + 1}</span><span>${index === 0 ? 'Leads this scenario' : 'Compare the trade-offs'}</span></header><div class="card-body"><h3>${city.name}</h3><div class="card-stats"><div><span>Scenario score · demo assessments</span><strong>${city.score.toFixed(1)} <small>/ 100</small></strong></div><div><span>Estimated ${scope.heading.toLowerCase()}</span><strong>${money(city.budgetCost)}</strong><small>a year · ${budgetNote(city)}</small></div></div><details class="result-detail"><summary>Why this city?</summary><ul>${city.reasons.slice(0, 2).map(reason => `<li>${safe(reason)}</li>`).join('')}</ul><p class="tradeoff">${safe(city.tradeoffs.slice(0, 2).join(' '))}</p></details></div><footer><button class="link-button" data-city-evidence="${city.id}">See company evidence</button><button class="link-button" data-city-score="${city.id}">Inspect the score</button></footer></article>`).join('');
  atlas$('#atlas-score-head').innerHTML = `<tr><th>Points contributed</th>${result.ranked.map(city => `<th>${city.name}</th>`).join('')}</tr>`;
  atlas$('#atlas-score-body').innerHTML = CRITERIA.map(criterion => `<tr><td>${criterion.label}<small>Weight ${atlasPlan.weights[criterion.id]}%</small></td>${result.ranked.map(city => { const component = city.components.find(item => item.id === criterion.id); return `<td><strong>${component.contribution.toFixed(1)} points</strong><small>Rating ${component.raw.toFixed(2)} / 5</small></td>`; }).join('')}</tr>`).join('') + `<tr><td><strong>Total</strong></td>${result.ranked.map(city => `<td><strong>${city.score.toFixed(1)} / 100</strong></td>`).join('')}</tr>`;
  atlas$('#atlas-roadmap').innerHTML = result.roadmap.map(stage => `<li><strong>${safe(stage.title)}</strong><p>${safe(stage.description)}</p></li>`).join('');
  renderCostBreakdown(result);
}
function openAtlasDetail(title, html) { atlas$('#atlas-detail-type').textContent = title; atlas$('#atlas-detail-body').innerHTML = html; atlas$('#atlas-detail-dialog').showModal(); }
function recordSource(record) {
  const parties = ['partner', 'workplace', 'government'].filter(key => record[key]);
  return `<article class="source-card"><h3>${safe(record.company)} · ${EVENTS[record.event]}</h3><p>${safe(record.summary)}</p><p>${safe(record.cities.join(', '))} · ${textDate(record.publishedOn)} · ${KINDS[record.source.kind] || 'Source'}</p>${external(record.source.url, record.source.title)}<p>${safe(record.source.publisher)} · Checked ${formatDate(evidence.checkedOn)} · ${checkedLabel(record)}</p><blockquote>${safe(record.receipt)}</blockquote>${parties.map(key => `<p><strong>${safe(record[key].name)}</strong> · ${safe(record[key].role)}</p><blockquote>${safe(record[key].quote)}</blockquote>`).join('')}${record.hiring ? `<p><strong>Headcount claim:</strong> ${safe(record.hiring.claim)}</p><blockquote>${safe(record.hiring.quote)}</blockquote>` : '<p>Headcount: not recorded in this sample.</p>'}</article>`;
}
function showCompanyProfile(id) {
  const group = atlasCompanies.find(company => company.id === id || company.records.some(record => record.id === id));
  if (!group) return;
  openAtlasDetail('GCC PROFILE', `<h2>${safe(group.company)}</h2><dl><dt>Locations in sample</dt><dd>${safe(group.cities.join(', '))}</dd><dt>Parent company</dt><dd>Not separately recorded; the announcement’s company name is shown.</dd><dt>Sector tag</dt><dd>${safe(group.sector)} · editorial interpretation</dd><dt>Work tags</dt><dd>${group.functions.length ? group.functions.map(id => FUNCTIONS[id]).join(', ') : 'Not recorded'} · editorial interpretation</dd><dt>Evidence scope</dt><dd>Historical or announced activity as stated in each source. No present headcount is inferred.</dd></dl>${group.records.length > 1 ? '<p>There are multiple announcements. Compare their dates and scope before treating different figures as a conflict.</p>' : ''}${group.records.map(recordSource).join('')}`);
}
function showCityEvidence(id) {
  const city = ATLAS_CITIES.find(entry => entry.id === id);
  const records = evidence.records.filter(record => record.cities.includes(city.name));
  openAtlasDetail('CITY SOURCE RECORD', `<h2>${city.name}: what sources say</h2><p>${records.length} announcements in this curated sample. They show precedent, not the number of GCCs in this city or people available to hire.</p><p>The city’s talent and readiness scores are demo assumptions; these announcements do not validate those scores.</p>${records.length ? records.map(recordSource).join('') : '<p>No announcement in the existing sample names this city. This does not mean it has no GCCs.</p>'}`);
}
function showCityScore(id) {
  const city = evaluateAtlas(atlasPlan).ranked.find(entry => entry.id === id); if (!city) return;
  const scope = BUDGET_SCOPES[atlasPlan.budgetScope];
  openAtlasDetail('TRANSPARENT SCORING', `<h2>${city.name} · ${city.score.toFixed(1)} / 100</h2><p>Every non-cost rating here is a demo assumption. This is a scenario score, not a verified market ranking.</p><div class="table-scroll"><table class="atlas-table"><thead><tr><th>Criterion</th><th>Rating / 5</th><th>Weight</th><th>Points</th></tr></thead><tbody>${city.components.map(component => `<tr><td>${component.label}</td><td>${component.raw.toFixed(2)}</td><td>${component.weight}%</td><td>${component.contribution.toFixed(1)}</td></tr>`).join('')}</tbody></table></div><h3>Cost estimate</h3><p>${city.costLines.map(line => `${safe(line.label)}: ${money(line.amount)} (${safe(line.detail)})`).join('<br>')}<br><strong>${scope.heading}: ${money(city.budgetCost)} a year.</strong></p><p>The cost rating uses the running cost: salaries, benefits and office rent, ${money(city.costs.total)} a year.</p><p>Salary reference: ${external(city.salarySource.url, city.salarySource.name)}, ${safe(city.salarySource.asOf)}; a software-engineer median, not a quote. Benefits and office rent are planning assumptions.${atlasPlan.budgetScope === 'total' ? ` The other lines are per-person benchmarks from ${external(BENCHMARK_SOURCE.url, BENCHMARK_SOURCE.name)}, ${safe(BENCHMARK_SOURCE.asOf)}.` : ''}</p><p>${safe(ATLAS_METHODOLOGY)}</p>`);
}
function renderCompanyList() {
  const query = atlas$('#atlas-company-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean), city = atlas$('#atlas-company-city').value, sector = atlas$('#atlas-company-sector').value, fn = atlas$('#atlas-company-function').value, sort = atlas$('#atlas-company-sort').value;
  const filtered = atlasCompanies.filter(company => (!city || company.cities.includes(city)) && (!sector || company.sector === sector) && (!fn || company.functions.includes(fn)) && query.every(word => `${company.company} ${company.cities.join(' ')} ${company.records.map(record => `${record.summary} ${record.partner?.name || ''} ${record.workplace?.name || ''} ${record.government?.name || ''}`).join(' ')} ${company.sector} ${company.functions.map(id => FUNCTIONS[id]).join(' ')}`.toLowerCase().includes(word))).sort((a, b) => sort === 'name' ? a.company.localeCompare(b.company) : sort === 'oldest' ? a.latest.localeCompare(b.latest) : b.latest.localeCompare(a.latest));
  atlas$('#atlas-company-count').textContent = `${filtered.length} of ${atlasCompanies.length} companies · ${evidence.records.length} total announcements`;
  atlas$('#atlas-company-empty').hidden = filtered.length > 0;
  atlas$('#atlas-company-rows').innerHTML = filtered.map(company => `<tr><td><strong>${safe(company.company)}</strong><small>${company.records.length} ${company.records.length === 1 ? 'announcement' : 'announcements'}</small></td><td>${safe(company.cities.join(', '))}</td><td>${safe(company.sector)}<small>${company.functions.length ? company.functions.map(id => FUNCTIONS[id]).join(' · ') : 'Work not recorded'}</small></td><td>${EVENTS[company.records[0].event]}</td><td>${textDate(company.latest)}<small>${checkedLabel(company.records[0])}</small></td><td><button class="link-button" data-company="${safe(company.id)}">Open profile</button></td></tr>`).join('');
}
function clearCompanies() { for (const id of ['atlas-company-query', 'atlas-company-city', 'atlas-company-sector', 'atlas-company-function']) atlas$(`#${id}`).value = ''; renderCompanyList(); }
function renderProviders() {
  const query = atlas$('#atlas-provider-query').value.trim().toLowerCase(), category = atlas$('#atlas-provider-category').value, city = atlas$('#atlas-provider-city').value, status = atlas$('#atlas-provider-evidence').value;
  atlasAll('[data-service]').forEach(button => { const selected = button.dataset.service === category; button.setAttribute('aria-pressed', String(selected)); });
  const providers = ATLAS_PROVIDERS.filter(provider => (!category || provider.category === category) && (!city || provider.cities.includes(city) || provider.cities.includes('India')) && (!status || (status === 'relationship' ? provider.announcementIds.length > 0 : provider.announcementIds.length === 0)) && `${provider.name} ${provider.description} ${provider.services.join(' ')}`.toLowerCase().includes(query));
  atlas$('#atlas-provider-count').textContent = `${providers.length} of ${ATLAS_PROVIDERS.length} providers${city ? ' · includes stated India-wide scope' : ''}`;
  atlas$('#atlas-provider-empty').hidden = providers.length > 0;
  atlas$('#atlas-provider-grid').innerHTML = providers.map(provider => `<article class="panel provider-card" data-provider-card="${provider.id}"><span class="tag">${CATEGORY_NAMES[provider.category]}</span><h2>${provider.name}</h2><p class="location">${provider.cities.includes('India') ? 'Stated country scope: India' : `Documented locations: ${safe(provider.cities.join(', '))}`}</p><div class="tags">${provider.services.slice(0, 3).map(service => `<span class="tag">${safe(service)}</span>`).join('')}</div><footer><span>${provider.verification}</span><button class="link-button" data-provider="${provider.id}">View evidence</button></footer><div class="provider-select">${providerSelectButton(provider)}</div></article>`).join('');
}
function clearProviders() { for (const id of ['atlas-provider-query', 'atlas-provider-category', 'atlas-provider-city', 'atlas-provider-evidence']) atlas$(`#${id}`).value = ''; renderProviders(); }
function providerSelectButton(provider) { const selected = shortlistedProviderIds.includes(provider.id); return `<button class="button ${selected ? 'secondary' : 'primary'}" data-shortlist-provider="${provider.id}" aria-pressed="${selected}">${selected ? 'Remove from my shortlist' : 'Add to my shortlist'}</button>`; }
function providerQuestions(provider) {
  const checks = { setup: 'Who will own the entity, contracts and IP, and how does handover work?', legal: 'Which entity, employment and cross-border obligations apply to our structure?', tax: 'What tax, transfer-pricing, audit and filing scope is included in the mandate?', talent: 'What comparable roles have you filled recently, at what pay and hiring pace?', payroll: 'Who is the legal employer, which fees apply, and how would employees transfer?', property: 'Can you provide current rent, deposit, fit-out and available-space quotations?' };
  return [`Request a relevant client reference for ${evaluateAtlas(atlasPlan).ranked[0]?.name || 'our shortlisted city'} and our function mix; public coverage does not establish local delivery.`, checks[provider.category], 'Ask for itemised costs, dependencies, exclusions and evidence of delivery. No outcome is verified by this prototype.'];
}
function providerBriefHtml() {
  const providers = shortlistedProviderIds.map(id => ATLAS_PROVIDERS.find(provider => provider.id === id));
  return providers.length ? providers.map(provider => `<article class="source-card"><h3>${safe(provider.name)}</h3><p>${safe(provider.verification)} · ${safe(provider.coverageNote)}</p><p>${safe(provider.caveat)}</p><p>${provider.sources.map(source => external(source.url, source.title)).join(' · ')}</p><h4>Questions still to answer</h4><ul>${providerQuestions(provider).map(question => `<li>${safe(question)}</li>`).join('')}</ul></article>`).join('') : '<p>No providers shortlisted yet. Add providers after inspecting their evidence.</p>';
}
function renderProviderShortlist() {
  const providers = shortlistedProviderIds.map(id => ATLAS_PROVIDERS.find(provider => provider.id === id));
  atlas$('#atlas-shortlist-summary').textContent = providers.length ? `${providers.length} provider${providers.length === 1 ? '' : 's'} chosen by you. Included when you save or export this decision.` : 'No providers yet. Browse services to start your shortlist.';
  atlas$('#atlas-shortlist-items').innerHTML = providers.map(provider => `<li><div><strong>${safe(provider.name)}</strong><small>${safe(provider.verification)} · ${safe(CATEGORY_NAMES[provider.category])}</small></div><button class="link-button" data-provider="${provider.id}">Evidence</button><button class="link-button" data-shortlist-provider="${provider.id}">Remove</button></li>`).join('');
  atlas$('#atlas-provider-selection-count').textContent = `${providers.length} provider${providers.length === 1 ? '' : 's'} in your shortlist`;
}
function toggleProvider(id) {
  if (!ATLAS_PROVIDERS.some(provider => provider.id === id)) return;
  const selected = shortlistedProviderIds.includes(id);
  shortlistedProviderIds = selected ? shortlistedProviderIds.filter(value => value !== id) : [...shortlistedProviderIds, id];
  const stored = persist(STORAGE_PROVIDERS, shortlistedProviderIds);
  renderProviders(); renderProviderShortlist();
  atlasAll(`[data-shortlist-provider="${id}"]`).forEach(button => { if (button.closest('#atlas-detail-dialog')) { const active = shortlistedProviderIds.includes(id); button.textContent = active ? 'Remove from my shortlist' : 'Add to my shortlist'; button.className = `button ${active ? 'secondary' : 'primary'}`; button.setAttribute('aria-pressed', String(active)); } });
  atlasToast(stored ? (selected ? 'Removed from your provider shortlist.' : 'Added to your shortlist. Save or export the decision to keep its context.') : 'Shortlist changed for this session. Browser storage is unavailable; download the report.');
}
function showProvider(id) {
  const provider = ATLAS_PROVIDERS.find(item => item.id === id); if (!provider) return;
  const relations = provider.announcementIds.map(announcementId => evidence.records.find(record => record.id === announcementId)).filter(Boolean);
  openAtlasDetail('PROVIDER PROFILE', `<span class="tag">${CATEGORY_NAMES[provider.category]}</span><h2>${provider.name}</h2><p>${safe(provider.description)}</p><div class="tags">${provider.services.map(service => `<span class="tag">${safe(service)}</span>`).join('')}</div><h3>Coverage and verification</h3><p>${safe(provider.coverageNote)}</p><p><strong>${safe(provider.verification)}</strong> · Checked ${formatDate(ATLAS_DATA_CHECKED_ON)}</p><p>${safe(provider.caveat)}</p><div class="action-group">${external(provider.website, 'Official website')}${external(provider.contactUrl, 'Contact / booking page')}</div><p class="scope-note">These links open the provider’s website. Nothing is sent by this prototype.</p><div class="provider-select">${providerSelectButton(provider)}</div><h3>Questions to ask</h3><ul>${providerQuestions(provider).map(question => `<li>${safe(question)}</li>`).join('')}</ul><h3>Supporting sources</h3>${provider.sources.map(source => `<article class="source-card">${external(source.url, source.title)}<p>${safe(source.publisher)} · ${textDate(source.publishedOn)} · Checked ${formatDate(source.accessedOn)}</p><p>${safe(source.claim)}</p></article>`).join('')}${relations.length ? `<h3>Named relationships in the record</h3>${relations.map(recordSource).join('')}` : '<p>No particular GCC client relationship is verified by this record. Request relevant references directly.</p>'}`);
}
function renderSaved() {
  atlas$('#atlas-save-count').textContent = savedDecisions.length;
  atlas$('#atlas-saved-empty').hidden = savedDecisions.length > 0;
  atlas$('#atlas-saved-list').innerHTML = savedDecisions.map(item => { const result = evaluateAtlas(item.plan), city = result.ranked[0]; return `<article class="panel saved-card"><span class="tag">Saved ${new Date(item.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span><h2>${item.plan.headcount} people · ${item.plan.functions.map(id => FUNCTIONS[id]).join(' / ')}</h2><p>${city ? `${city.name} led the saved scenario · ${money(city.budgetCost)} ${BUDGET_SCOPES[item.plan.budgetScope].heading.toLowerCase()} a year.` : 'No ranking in this saved scenario.'}</p><p>Budget ${money(result.budgetRupees)} · ${BUDGET_SCOPES[item.plan.budgetScope].label.toLowerCase()} · ${item.plan.timeline}-month target</p><p>${item.providerIds.length} shortlisted providers · evidence and open questions included.</p><footer><button class="link-button" data-reopen="${safe(item.id)}">Reopen decision</button><button class="link-button" data-remove="${safe(item.id)}">Remove</button></footer></article>`; }).join('');
}
function saveAtlasDecision() {
  if (!syncAtlasForm(true)) return;
  if (!evaluateAtlas(atlasPlan).ranked.length) return;
  const item = { id: globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}`, createdAt: new Date().toISOString(), plan: JSON.parse(JSON.stringify(atlasPlan)), providerIds: [...shortlistedProviderIds] };
  const next = [item, ...savedDecisions].slice(0, 50);
  if (!persist(STORAGE_SAVED, next)) return atlasToast('Browser storage is unavailable. Download the report instead.');
  savedDecisions = next; renderSaved(); atlasToast('Decision saved in this browser.');
}
function atlasReportText() {
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0], scope = BUDGET_SCOPES[atlasPlan.budgetScope];
  const lines = ['# GCC Atlas — India decision report', '', `Created ${currentDate()}`, `Team: ${atlasPlan.headcount} people; ${atlasPlan.functions.map(id => FUNCTIONS[id]).join(', ')}`, `Budget: ${money(result.budgetRupees)}; covers: ${scope.label.toLowerCase()}`, `Setup target: ${atlasPlan.timeline} months, not a promised schedule.`, `Priority: ${atlasPlan.priority}`, '', `First under the saved assumptions: ${lead?.name || 'No ranking'}.`, '**All non-cost city ratings are demo assumptions, not measured city facts.**', '', `| City | Scenario score / 100 | ${scope.heading}, a year | Budget check |`, '| --- | --- | --- | --- |', ...result.ranked.map(city => `| ${city.name} | ${city.score.toFixed(1)} | ${money(city.budgetCost)} | ${sentenceCase(budgetNote(city))} |`), '', '## Budget and other cautions', '', result.scopeExplanation, ...result.warnings.map(warning => `- ${warning.message}`), '', '## Weights', 'Set by your priority.', ...CRITERIA.map(criterion => `- ${criterion.label}: ${atlasPlan.weights[criterion.id]}%`), '', '## What the cost estimate includes', ...(lead?.costLines || []).map((line, index) => `- ${line.label} (${COST_SOURCES[line.source]}): ${result.ranked.map(city => `${city.name} ${money(city.costLines[index].amount)}`).join('; ')}.`), `- Not included: ${scope.excluded}.`, '', '## Demo city ratings', ...ATLAS_CITIES.filter(city => !atlasPlan.excludedCities.includes(city.id)).map(city => `- ${city.name}: ${Object.entries(atlasPlan.assessments[city.id]).map(([key, value]) => `${key} ${value}/5`).join('; ')}.`), '', '## Scoring method', '', ATLAS_METHODOLOGY, '', '## Cost sources', '', `Salaries: starting software-engineer median reference, ${ATLAS_CITIES[0].salarySource.asOf}: ${ATLAS_CITIES[0].salarySource.url}`, 'A software median does not establish salaries for your role mix, seniority, or hiring timeline. Check it against your own evidence.', ...(atlasPlan.budgetScope === 'total' ? [`Benchmarks: ${BENCHMARK_SOURCE.name}, ${BENCHMARK_SOURCE.asOf}. Averages per person across more than 60 GCCs, not quotes: ${BENCHMARK_SOURCE.url}`] : []), `Benefits (${atlasPlan.overhead}% of salaries) and office rent (${Math.round(atlasPlan.seatRatio * 100)} desks per 100 people) are GCC Atlas planning assumptions.`, '', '## Next steps', ...result.roadmap.map(stage => `- ${stage.title}: ${stage.description}`), '', '## Your notes', atlasPlan.constraints || 'None entered.', '', '## Company evidence', '', `Curated announcement record checked ${evidence.checkedOn}; not a census, current headcount survey, or hiring-availability measure.`];
  for (const record of evidence.records.filter(record => result.ranked.some(city => record.cities.includes(city.name)))) lines.push(`- ${record.company} / ${record.cities.join(', ')} / ${EVENTS[record.event]} / source ${record.publishedOn || 'undated'}: ${record.source.url}`, `  - ${record.summary}`, `  - Evidence status: ${checkedLabel(record)}.`);
  lines.push('', '## Your provider shortlist', '', 'These are your choices, not ranked recommendations. Questions below remain unanswered.');
  for (const id of shortlistedProviderIds) { const provider = ATLAS_PROVIDERS.find(item => item.id === id); lines.push(`- ${provider.name}: ${provider.verification}. ${provider.coverageNote}`, `  - ${provider.caveat}`, ...provider.sources.map(source => `  - Evidence: ${source.claim} (${source.url})`), ...providerQuestions(provider).map(question => `  - Open question: ${question}`)); }
  if (!shortlistedProviderIds.length) lines.push('No providers selected.');
  lines.push('', '## Provider source directory', '', 'This is an alphabetical evidence directory, not a quality recommendation or paid placement.');
  for (const provider of [...ATLAS_PROVIDERS].sort((a, b) => a.name.localeCompare(b.name))) lines.push(`- ${provider.name}: ${CATEGORY_NAMES[provider.category]}. ${provider.website}`, `  - ${provider.verification}. ${provider.coverageNote}`, ...provider.sources.map(source => `  - ${source.publisher}: ${source.claim} (${source.url})`));
  lines.push('', '## Product limits', 'No AI model runs in this prototype. AI tools helped research and build it; the source record shows three saved examples of that research step.', 'No consultation has been booked or sent. No live provider performance ranking, legal assessment, or incentive eligibility calculation is included.', 'Saved decisions stay in this browser.');
  return lines.join('\n');
}
function showAtlasReport() {
  if (!syncAtlasForm(true)) return;
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0], scope = BUDGET_SCOPES[atlasPlan.budgetScope]; if (!lead) return;
  atlas$('#atlas-report-body').innerHTML = `<article class="report-body"><p class="eyebrow">GCC ATLAS · ${currentDate()}</p><h2>Your India city comparison</h2><p>${atlasPlan.headcount} people · ${atlasPlan.functions.map(id => FUNCTIONS[id]).join(' / ')} · ${money(result.budgetRupees)} budget for ${scope.heading.toLowerCase()} · ${atlasPlan.timeline}-month target.</p><div class="notice"><strong>${lead.name} leads this scenario.</strong><span>All non-cost ratings are demo assumptions. Check hiring, setup dependencies, and current quotations before a real decision.</span></div><div class="table-scroll"><table class="atlas-table"><thead><tr><th>City</th><th>Scenario score</th><th>${scope.heading}, a year</th><th>Budget check</th></tr></thead><tbody>${result.ranked.map(city => `<tr><td>${city.name}</td><td>${city.score.toFixed(1)} / 100</td><td>${money(city.budgetCost)}</td><td>${sentenceCase(budgetNote(city))}</td></tr>`).join('')}</tbody></table></div><h3>Budget scope and cautions</h3><p>${safe(result.scopeExplanation)}</p><ul>${result.warnings.map(warning => `<li>${safe(warning.message)}</li>`).join('')}</ul><h3>Weights, costs and ratings</h3><p>Weights from your priority: ${CRITERIA.map(criterion => `${criterion.label} ${atlasPlan.weights[criterion.id]}%`).join(' · ')}.</p><ul>${lead.costLines.map((line, index) => `<li>${safe(line.label)} (${safe(COST_SOURCES[line.source])}): ${result.ranked.map(city => `${city.name} ${money(city.costLines[index].amount)}`).join(' · ')}.</li>`).join('')}<li>Not included: ${safe(scope.excluded)}.</li></ul><ul>${ATLAS_CITIES.filter(city => !atlasPlan.excludedCities.includes(city.id)).map(city => `<li>${city.name}. Demo ratings: ${Object.entries(atlasPlan.assessments[city.id]).map(([key, value]) => `${key} ${value}/5`).join(', ')}.</li>`).join('')}</ul><p>Starting salary reference: ${external(ATLAS_CITIES[0].salarySource.url, ATLAS_CITIES[0].salarySource.name)}, ${safe(ATLAS_CITIES[0].salarySource.asOf)}. These software medians are not salaries for every function.${atlasPlan.budgetScope === 'total' ? ` Cost benchmarks: ${external(BENCHMARK_SOURCE.url, BENCHMARK_SOURCE.name)}, ${safe(BENCHMARK_SOURCE.asOf)}; averages per person, not quotes.` : ''} Benefits and office rent are planning assumptions.</p><h3>How the score works</h3><p>${safe(ATLAS_METHODOLOGY)}</p><h3>What to check next</h3><ul>${result.roadmap.map(stage => `<li><strong>${safe(stage.title)}</strong> ${safe(stage.description)}</li>`).join('')}</ul>${atlasPlan.constraints ? `<h3>Your notes</h3><p>${safe(atlasPlan.constraints)}</p>` : ''}<h3>Company evidence by city</h3>${result.ranked.map(city => `<h3>${city.name}</h3><ul>${evidence.records.filter(record => record.cities.includes(city.name)).map(record => `<li>${external(record.source.url, record.company)} · ${textDate(record.publishedOn)} · ${EVENTS[record.event]}</li>`).join('') || '<li>No records in this sample.</li>'}</ul>`).join('')}<p class="scope-note">Source record checked ${formatDate(evidence.checkedOn)}. Announcements reflect their stated period. The report’s text download includes provider source references too. No live LLM, provider quality ranking, or incentive amount is used.</p></article>`;
  atlas$('#atlas-report-body .report-body').insertAdjacentHTML('beforeend', `<h3>Your provider shortlist and open questions</h3><p>Chosen by you; no provider quality ranking or contact has been made.</p>${providerBriefHtml()}`);
  atlas$('#atlas-report-dialog').showModal();
}
function showAtlasMethod() {
  openAtlasDetail('HOW THIS PROTOTYPE WORKS', `<h2>Facts, estimates, and choices.</h2><ol class="method-list"><li><strong>Company facts:</strong> Claude’s existing source record, with exact quotations, dates, and check status.</li><li><strong>Provider facts:</strong> official service pages or specifically named relationships. Marketing does not establish delivery quality.</li><li><strong>Salary references:</strong> software-engineer medians published by Flexiple, August 2026. A dated reference, not a hiring quote.</li><li><strong>Cost benchmarks:</strong> ${external(BENCHMARK_SOURCE.url, 'EY’s GCC Cost and Operations Benchmarking Study 2023')}, 2022 costs across more than 60 GCCs. Per-person averages for office running costs, technology, travel, admin, training and recruitment, used when your budget covers the total operating cost.</li><li><strong>Planning assumptions:</strong> ${atlasPlan.overhead}% of salaries for benefits and employer costs, and office rent of ${money(atlasPlan.costs[ATLAS_CITIES[0].id].desk)} a desk a month for ${Math.round(atlasPlan.seatRatio * 100)} desks per 100 people. Not sourced; check them against your own quotes.</li><li><strong>Your choices:</strong> team, functions, budget and what it covers, timeline target, and priority.</li><li><strong>Demo assessments:</strong> talent, readiness, ecosystem fit, and execution confidence use illustrative 1–5 ratings. They are not sourced city statistics.</li></ol><h3>The formula</h3><p>${safe(ATLAS_METHODOLOGY)}</p><h3>What is AI doing?</h3><p>No AI runs in this tool; the city model is deterministic. AI read the source announcements while the record was built, and a plain program kept only the quotes found word for word. The source record shows three saved examples of that step.</p><h3>What stays unknown?</h3><p>Current role-specific hiring capacity, provider outcomes, exact office quotes, policy eligibility, and one-time setup costs. No incentive savings are deducted.</p><p>Sector/work tags are editorial aids inferred from source descriptions. Parent entities and current headcount stay unrecorded where the source model does not establish them.</p>`);
}
document.addEventListener('click', event => {
  const service = event.target.closest('[data-service]');
  if (service) { atlas$('#atlas-provider-category').value = atlas$('#atlas-provider-category').value === service.dataset.service ? '' : service.dataset.service; renderProviders(); return; }
  const page = event.target.closest('[data-page]'); if (page) return setAtlasPage(page.dataset.page);
  const close = event.target.closest('[data-close]'); if (close) return document.getElementById(close.dataset.close).close();
  const company = event.target.closest('[data-company]'); if (company) return showCompanyProfile(company.dataset.company);
  const shortlist = event.target.closest('[data-shortlist-provider]'); if (shortlist) return toggleProvider(shortlist.dataset.shortlistProvider);
  const provider = event.target.closest('[data-provider]'); if (provider) return showProvider(provider.dataset.provider);
  const cityEvidence = event.target.closest('[data-city-evidence]'); if (cityEvidence) return showCityEvidence(cityEvidence.dataset.cityEvidence);
  const cityScore = event.target.closest('[data-city-score]'); if (cityScore) return showCityScore(cityScore.dataset.cityScore);
  const reopen = event.target.closest('[data-reopen]'); if (reopen) { const saved = savedDecisions.find(item => item.id === reopen.dataset.reopen); if (saved) { atlasPlan = customerAtlasPlan(saved.plan); shortlistedProviderIds = cleanProviderIds(saved.providerIds); persist(STORAGE_PROVIDERS, shortlistedProviderIds); renderProviderShortlist(); renderProviders(); fillAtlasForm(); renderAtlasResults(); persist(STORAGE_PLAN, atlasPlan); setAtlasPage('decision'); atlasToast('Saved inputs restored.'); } return; }
  const remove = event.target.closest('[data-remove]'); if (remove) { const next = savedDecisions.filter(item => item.id !== remove.dataset.remove); if (!persist(STORAGE_SAVED, next)) return atlasToast('Could not update browser storage.'); savedDecisions = next; renderSaved(); return atlasToast('Saved decision removed.'); }
  const action = event.target.closest('[data-action]'); if (!action) return;
  if (action.dataset.action === 'method') showAtlasMethod();
  if (action.dataset.action === 'clear-company') clearCompanies();
  if (action.dataset.action === 'clear-provider') clearProviders();
  if (action.dataset.action === 'relevant-providers') { const city = evaluateAtlas(atlasPlan).ranked[0]; clearProviders(); if (city) atlas$('#atlas-provider-city').value = city.name; renderProviders(); setAtlasPage('providers'); }
});
atlas$('#atlas-plan-form').addEventListener('input', () => syncAtlasForm());
atlas$('#atlas-plan-form').addEventListener('change', () => syncAtlasForm());
atlas$('#atlas-plan-form').addEventListener('submit', event => { event.preventDefault(); if (syncAtlasForm(true)) { atlas$('#atlas-results').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); atlas$('#atlas-results-title').focus({ preventScroll: true }); } });
atlas$('#atlas-reset').addEventListener('click', () => { atlasPlan = defaultAtlasPlan(); shortlistedProviderIds = []; persist(STORAGE_PROVIDERS, shortlistedProviderIds); renderProviderShortlist(); renderProviders(); fillAtlasForm(); renderAtlasResults(); persist(STORAGE_PLAN, atlasPlan); atlas$('#atlas-input-error').textContent = ''; atlasToast('Starting example restored.'); });
atlas$('#atlas-save').addEventListener('click', saveAtlasDecision);
atlas$('#atlas-report').addEventListener('click', showAtlasReport);
for (const id of ['atlas-company-query', 'atlas-company-city', 'atlas-company-sector', 'atlas-company-function', 'atlas-company-sort']) atlas$(`#${id}`).addEventListener(id.endsWith('query') ? 'input' : 'change', renderCompanyList);
for (const id of ['atlas-provider-query', 'atlas-provider-category', 'atlas-provider-city', 'atlas-provider-evidence']) atlas$(`#${id}`).addEventListener(id.endsWith('query') ? 'input' : 'change', renderProviders);
atlas$('#atlas-clear-company').addEventListener('click', clearCompanies); atlas$('#atlas-clear-provider').addEventListener('click', clearProviders);
atlas$('#atlas-download-report').addEventListener('click', () => { const blob = new Blob([atlasReportText()], { type: 'text/markdown;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'GCC-Atlas-Decision.md'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); atlasToast('Report downloaded.'); });
atlas$('#atlas-print-report').addEventListener('click', () => window.print());
atlasAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
});
window.addEventListener('hashchange', () => setAtlasPage(location.hash.slice(1), true, false));
window.addEventListener('popstate', () => setAtlasPage(location.hash.slice(1), true, false));
for (const [id, values] of [['atlas-company-city', [...new Set(atlasCompanies.flatMap(company => company.cities))].sort()], ['atlas-company-sector', [...new Set(atlasCompanies.map(company => company.sector))].sort()]]) atlas$(`#${id}`).insertAdjacentHTML('beforeend', values.map(value => `<option value="${safe(value)}">${safe(value)}</option>`).join(''));
atlas$('#atlas-company-function').insertAdjacentHTML('beforeend', Object.entries(FUNCTIONS).map(([id, label]) => `<option value="${id}">${label}</option>`).join(''));
const initialService = new URLSearchParams(location.search).get('service');
if (Object.hasOwn(CATEGORY_NAMES, initialService)) atlas$('#atlas-provider-category').value = initialService;
fillAtlasForm(); renderAtlasResults(); renderCompanyList(); renderProviders(); renderProviderShortlist(); renderSaved(); setAtlasPage(location.hash.slice(1), false, false);
