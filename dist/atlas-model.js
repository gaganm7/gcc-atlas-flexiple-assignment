// Decision calculations only. Source records and UI live in separate modules.
import { CITIES as REFERENCE_CITIES, SALARY_SOURCE as ATLAS_SALARY_SOURCE, costs as referenceCosts } from './model.js';

export const FUNCTIONS = {
  technology: 'Technology',
  engineering: 'Engineering',
  finance: 'Finance',
  operations: 'Operations',
  research: 'R&D'
};

export const CRITERIA = [
  { id: 'talent', label: 'Talent and hiring', weight: 30 },
  { id: 'readiness', label: 'Setup readiness', weight: 25 },
  { id: 'cost', label: 'Operating cost', weight: 20 },
  { id: 'ecosystem', label: 'Fit for your work', weight: 15 },
  { id: 'risk', label: 'Execution confidence', weight: 10 }
];

export const PRIORITIES = {
  balanced: { talent: 30, readiness: 25, cost: 20, ecosystem: 15, risk: 10 },
  cost: { talent: 10, readiness: 10, cost: 60, ecosystem: 10, risk: 10 },
  talent: { talent: 65, readiness: 10, cost: 5, ecosystem: 15, risk: 5 },
  speed: { talent: 15, readiness: 60, cost: 5, ecosystem: 10, risk: 10 },
  ecosystem: { talent: 20, readiness: 5, cost: 5, ecosystem: 65, risk: 5 }
};

export const ATLAS_CITIES = ['bengaluru', 'hyderabad', 'pune', 'chennai'].map(id => {
  const city = REFERENCE_CITIES.find(entry => entry.id === id);
  return { id, name: city.name, referenceSalary: city.salary, salarySource: ATLAS_SALARY_SOURCE };
});

export const ATLAS_METHODOLOGY = 'This is a scenario comparison, not a measured city ranking. Talent, readiness, fit and execution confidence are editable illustrative assessments from 1 to 5; higher is better. Initial weights are product assumptions. Annual cost is salary + salary overhead + occupied desks × monthly desk cost × 12. The lowest-cost included city gets a cost rating of 5; each other cost rating is 5 × lowest annual cost ÷ its annual cost. Each contribution is rating ÷ 5 × weight ÷ total weights × 100; contributions add to the score out of 100. Scores compare only the included cities and do not prove feasibility. No incentives or one-time establishment expenses are included. Function selections change the due-diligence checklist; they do not create hidden city score adjustments.';

const ASSESSMENTS = {
  bengaluru: { talent: 5, readiness: 3.5, ecosystem: 5, risk: 2.5 },
  hyderabad: { talent: 4, readiness: 4.5, ecosystem: 4.5, risk: 3.5 },
  pune: { talent: 4, readiness: 4, ecosystem: 3.5, risk: 4 },
  chennai: { talent: 3.5, readiness: 3.5, ecosystem: 3.5, risk: 4 }
};

const FUNCTION_CHECKS = {
  technology: 'Check software roles, seniority, competing employers and expected hiring pace.',
  engineering: 'Check the required engineering disciplines, equipment and specialist hiring pool.',
  finance: 'Check accounting roles, financial controls, language needs and reporting obligations.',
  operations: 'Check process skills, shift coverage, language needs and service continuity.',
  research: 'Check specialist researchers, intellectual-property requirements and lab facilities.'
};

export function defaultAtlasPlan() {
  return {
    functions: ['technology'], headcount: 40, budget: 6, budgetScope: 'all', timeline: 6,
    priority: 'balanced', constraints: '', excludedCities: [],
    weights: { ...PRIORITIES.balanced },
    costs: Object.fromEntries(ATLAS_CITIES.map(city => [city.id, { salary: city.referenceSalary, desk: 10000 }])),
    overhead: 20, seatRatio: 0.6,
    assessments: Object.fromEntries(ATLAS_CITIES.map(city => [city.id, { ...ASSESSMENTS[city.id] }]))
  };
}

const numeric = (value, min, max, fallback, decimals = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(Math.min(max, Math.max(min, value)).toFixed(decimals)) : fallback;

export function normalizeAtlasPlan(value) {
  const plan = defaultAtlasPlan();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return plan;
  if (Array.isArray(value.functions)) {
    const selected = Object.keys(FUNCTIONS).filter(key => value.functions.includes(key));
    if (selected.length) plan.functions = selected;
  }
  plan.headcount = numeric(value.headcount, 5, 2000, plan.headcount);
  plan.budget = numeric(value.budget, 0.01, 10000, plan.budget, 2);
  plan.timeline = numeric(value.timeline, 1, 24, plan.timeline);
  plan.budgetScope = value.budgetScope === 'salary' ? 'salary' : 'all';
  plan.priority = Object.hasOwn(PRIORITIES, value.priority) ? value.priority : 'balanced';
  plan.constraints = typeof value.constraints === 'string' ? value.constraints.trim().slice(0, 1000) : '';
  plan.excludedCities = ATLAS_CITIES.map(city => city.id).filter(id => Array.isArray(value.excludedCities) && value.excludedCities.includes(id));
  plan.overhead = numeric(value.overhead, 0, 100, plan.overhead, 1);
  plan.seatRatio = numeric(value.seatRatio, 0.1, 1, plan.seatRatio, 2);
  for (const criterion of CRITERIA) {
    plan.weights[criterion.id] = numeric(value.weights?.[criterion.id], 0, 100, PRIORITIES[plan.priority][criterion.id], 1);
  }
  for (const city of ATLAS_CITIES) {
    plan.costs[city.id].salary = numeric(value.costs?.[city.id]?.salary, 1, 100, city.referenceSalary, 1);
    plan.costs[city.id].desk = numeric(value.costs?.[city.id]?.desk, 1000, 100000, 10000);
    for (const key of Object.keys(ASSESSMENTS[city.id])) {
      plan.assessments[city.id][key] = numeric(value.assessments?.[city.id]?.[key], 1, 5, ASSESSMENTS[city.id][key], 1);
    }
  }
  return plan;
}

const currency = rupees => `₹${(rupees / 10000000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} crore`;
const cityNames = cities => new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(cities.map(city => city.name));

function roadmapFor(plan) {
  const functions = new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(plan.functions.map(id => FUNCTIONS[id]));
  return [
    { stage: '01', title: 'Define the work and team', description: `Confirm the ${functions.toLowerCase()} roles, seniority and ${plan.headcount}-person hiring plan. ${plan.functions.map(id => FUNCTION_CHECKS[id]).join(' ')}` },
    { stage: '02', title: 'Validate the city shortlist', description: 'Replace demonstration assessments with role-specific hiring evidence and current office quotes. Check the announcements and source dates; a peer company does not prove available talent.' },
    { stage: '03', title: 'Choose the setup approach', description: 'Compare an owned entity, a setup partner and interim employment options with qualified advisers. Validate compliance, tax obligations and any applicable incentives against current official sources.' },
    { stage: '04', title: 'Build the launch plan', description: `Ask providers for documented experience, quotes and a hiring sequence. Treat ${plan.timeline} months as your target, then validate dependencies and one-time setup costs before approving a launch.` }
  ];
}

export function evaluateAtlas(value) {
  const plan = normalizeAtlasPlan(value);
  const budgetRupees = Math.round(plan.budget * 10000000);
  const weightTotal = CRITERIA.reduce((sum, criterion) => sum + plan.weights[criterion.id], 0);
  const weightsValid = weightTotal > 0;
  const scopeExplanation = plan.budgetScope === 'salary'
    ? 'The budget covers annual salaries only. Salary overhead, office costs and one-time setup expenses need a separate budget.'
    : 'The budget is compared with annual salaries, salary overhead and desk costs. One-time setup expenses and other operating costs are excluded.';
  const warnings = [{ kind: 'assumptions', message: 'City assessments and desk/overhead inputs are illustrative, editable assumptions. This shortlist is a starting point for due diligence.' }];
  if (plan.functions.some(id => id !== 'technology')) {
    warnings.push({ kind: 'salary-reference', message: 'Starting salary inputs are Flexiple software-engineer medians, not benchmarks for your full mix of functions or seniority. Replace them with role-specific quotes before using the budget comparison.' });
  }
  if (plan.timeline < 4) {
    warnings.push({ kind: 'timeline', message: 'Your target is under four months. This is a planning flag chosen for the prototype, not a researched minimum setup time. Validate hiring, entity and office dependencies with providers.' });
  }
  if (plan.constraints) {
    warnings.push({ kind: 'constraints', message: 'Your preferences are saved for the decision brief. Free-text preferences do not automatically change ratings or costs; apply them through city exclusions and editable assumptions.' });
  }
  if (!weightsValid) warnings.push({ kind: 'weights', message: 'Give at least one criterion a weight above zero to generate a ranking.' });
  const candidates = ATLAS_CITIES.filter(city => !plan.excludedCities.includes(city.id)).map(city => ({
    ...city,
    costs: referenceCosts(city.id, {
      team: plan.headcount, overhead: plan.overhead, seatRatio: plan.seatRatio,
      desk: plan.costs[city.id].desk,
      salaries: Object.fromEntries(ATLAS_CITIES.map(entry => [entry.id, plan.costs[entry.id].salary]))
    })
  }));
  if (!candidates.length) warnings.push({ kind: 'cities', message: 'Include at least one city to generate a shortlist.' });
  const salaryMismatch = candidates.filter(city => city.costs.salary > budgetRupees);
  const totalMismatch = candidates.filter(city => city.costs.salary <= budgetRupees && city.costs.total > budgetRupees);
  if (salaryMismatch.length) {
    warnings.push({ kind: 'budget-salary', cityIds: salaryMismatch.map(city => city.id), message: `The annual budget is below the salary estimate for ${cityNames(salaryMismatch)} at ${plan.headcount} people. Review headcount, salary inputs or budget.` });
  }
  if (plan.budgetScope === 'all' && totalMismatch.length) {
    warnings.push({ kind: 'budget-total', cityIds: totalMismatch.map(city => city.id), message: `Salaries fit the entered budget in ${cityNames(totalMismatch)}, but salary overhead and desk costs take the annual estimate above it.` });
  }
  const lowest = Math.min(...candidates.map(city => city.costs.total));
  const ranked = weightsValid ? candidates.map(city => {
    const components = CRITERIA.map(criterion => {
      const raw = criterion.id === 'cost' ? 5 * lowest / city.costs.total : plan.assessments[city.id][criterion.id];
      const weight = plan.weights[criterion.id];
      return { id: criterion.id, label: criterion.label, raw, weight, contribution: raw / 5 * weight / weightTotal * 100 };
    });
    const strongest = [...components].sort((a, b) => b.contribution - a.contribution)[0];
    const weakest = [...components].filter(component => component.id !== 'cost' && component.weight > 0).sort((a, b) => a.raw - b.raw)[0];
    const reasons = [
      `${strongest.label} contributes ${strongest.contribution.toFixed(1)} points under your weights. Its ${strongest.raw.toFixed(1)}/5 rating is ${strongest.id === 'cost' ? 'calculated from the cost inputs' : 'an editable demonstration assumption'}.`,
      `The entered salary, overhead and desk inputs total ${currency(city.costs.total)} per year for ${plan.headcount} people.`,
      `For your ${plan.functions.map(id => FUNCTIONS[id].toLowerCase()).join(' / ')} plan: ${plan.functions.map(id => FUNCTION_CHECKS[id]).join(' ')}`
    ];
    const tradeoffs = [];
    if (city.costs.total > lowest) tradeoffs.push(`${currency(city.costs.total - lowest)} more per year than the lowest-cost included option with these inputs.`);
    if (weakest) tradeoffs.push(`${weakest.label} is assumed at ${weakest.raw.toFixed(1)}/5. Validate that assessment for your requirements.`);
    if (plan.budgetScope === 'all' && city.costs.total > budgetRupees) tradeoffs.push('The entered annual operating budget is below this estimate.');
    if (plan.budgetScope === 'salary' && city.costs.salary > budgetRupees) tradeoffs.push('The entered salary budget is below this salary estimate.');
    tradeoffs.push('Current incentives, specialist talent availability and one-time setup expenses have not been factored into the score.');
    return {
      ...city, score: components.reduce((sum, component) => sum + component.contribution, 0), components, reasons, tradeoffs,
      budgetStatus: { salaryWithinBudget: city.costs.salary <= budgetRupees, operatingWithinBudget: city.costs.total <= budgetRupees }
    };
  }).sort((a, b) => b.score - a.score || a.costs.total - b.costs.total || a.name.localeCompare(b.name)) : [];
  return { ranked, warnings, roadmap: roadmapFor(plan), budgetRupees, weightsValid, scopeExplanation, plan };
}
