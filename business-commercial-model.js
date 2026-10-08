/** Independent browser arithmetic for B3/B4. Money is JPY; prices are C scenarios.
 * The refund rule is OCCTO's 2026-09-02 Article 28, including 85% overlap priority.
 * No company-specific fees, tax advice, guaranteed credit or award are implied.
 */
const finite = (value, name, nonnegative = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0)) throw new Error(`${name}: finite ${nonnegative ? 'nonnegative ' : ''}number required`);
  return value;
};
function series(value, n, name, nonnegative = false) {
  const values = value == null ? Array(n).fill(0) : typeof value === 'number' && n != null ? Array(n).fill(value) : value;
  if (!Array.isArray(values) || !values.length || (n != null && values.length !== n)) throw new Error(`${name}: nonempty matching array required`);
  return values.map(v => finite(v, name, nonnegative));
}

export function allocateRevenues(revenues, kind, params = {}) {
  const totals = series(revenues, null, 'revenues');
  const fee = finite(params.fixedFee ?? 2e6, 'fixedFee', true);
  const share = finite(params.share ?? .1, 'share', true);
  const tolling = finite(params.tolling ?? 15e6, 'tolling', true);
  if (share > 1 || !['fixed-fee', 'revenue-share', 'tolling'].includes(kind)) throw new Error('invalid share or contract');
  return totals.map(total => {
    const owner = kind === 'tolling' ? tolling : total - (kind === 'fixed-fee' ? fee : Math.max(total, 0) * share);
    return { total, owner, provider: total - owner };
  });
}

export function windowStatus(asOf, start, end) {
  const dates = [asOf, start, end].map(value => {
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('explicit timezone required');
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error('invalid date');
    return parsed;
  });
  if (dates[1] > dates[2]) throw new Error('invalid window order');
  return dates[0] < dates[1] ? 'upcoming' : dates[0] > dates[2] ? 'closed' : 'open';
}

export function nationalGrantTerms(maximumConnectionKW, technology = 'lithium-ion', durationHours = 4) {
  const power = finite(maximumConnectionKW, 'maximumConnectionKW', true);
  const duration = finite(durationHours, 'durationHours', true);
  if (!['lithium-ion', 'reused', 'ldes'].includes(technology)) throw new Error('invalid technology');
  if (power < 1000) return { passes_power_screen: false, rate: null, cap_jpy: null };
  let rate, cap;
  if (technology === 'ldes') { rate = duration >= 6 ? 2 / 3 : 1 / 2; cap = 2e9; }
  else if (technology === 'reused') { rate = 1 / 2; cap = 2e9; }
  else if (power < 1e4) { rate = 1 / 3; cap = 1e9; }
  else if (power < 3e4) { rate = 1 / 3; cap = 2.5e9; }
  else { rate = 1 / 2; cap = 4e9; }
  return { passes_power_screen: true, rate, cap_jpy: cap };
}

export function ltdaBatteryEligibility(exportKW, continuousHours, annualAverageHours, gates = {}) {
  const p = finite(exportKW, 'exportKW', true), h = finite(continuousHours, 'continuousHours', true), avg = finite(annualAverageHours, 'annualAverageHours', true);
  const preOperation = gates.preOperation ?? true, mainlandJapan = gates.mainlandJapan ?? true, standalone = gates.standalone ?? true;
  if ([preOperation, mainlandJapan, standalone].some(v => typeof v !== 'boolean')) throw new Error('boolean gates required');
  const checks = [[p >= 3e4, '送电端可参与容量不足30MW'], [h >= 6, '每日连续运行不足6小时'], [avg >= 6, '连续运行时间年均不足6小时'], [preOperation, '本筛选只覆盖应札时尚未运营的新建/重置项目'], [mainlandJapan, '冲绳及其他离岛不在该拍卖范围'], [standalone, '本筛选不覆盖同址其他电源併設例外判定']];
  const reasons = checks.filter(([ok]) => !ok).map(([, reason]) => reason);
  return { passes_screen: reasons.length === 0, reasons, full_eligibility: null };
}

export function grantStack(eligibleCost, params = {}) {
  const cost = finite(eligibleCost, 'eligibleCost', true), national = finite(params.nationalGrant ?? 0, 'nationalGrant', true), rate = finite(params.localRate ?? 2 / 3, 'localRate', true), cap = finite(params.localCap ?? 2e9, 'localCap', true), unit = finite(params.roundingUnit ?? 1000, 'roundingUnit', true);
  if (rate > 1 || unit <= 0) throw new Error('invalid grant rate or rounding unit');
  const ceiling = cost * rate;
  if (national > ceiling + 1e-6) throw new Error('national grant exceeds combined ceiling');
  const local = Math.floor(Math.min(cap, Math.max(0, ceiling - national)) / unit + 1e-10) * unit;
  return { eligible_cost: cost, national, local, total: national + local, combined_ceiling: ceiling, unfunded_eligible_cost: cost - national - local };
}

export function ltdaRefund(otherProfit, annualLtdaCapacity, annualMainCapacity, annualCapitalCost, previousLoss = 0) {
  const profit = finite(otherProfit, 'otherProfit'), capacity = finite(annualLtdaCapacity, 'annualLtdaCapacity', true), main = finite(annualMainCapacity, 'annualMainCapacity', true), capital = finite(annualCapitalCost, 'annualCapitalCost', true), loss = finite(previousLoss, 'previousLoss', true);
  // Align the supplied decimal values on one exact integer scale. Applying
  // percentage numerators before integer division avoids losing one JPY to
  // binary floating point at an otherwise exact integer boundary.
  const parts = [profit, capacity, main, capital, loss].map(value => {
    const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
    return { integer: BigInt(coefficient.replace('.', '')), scale: (coefficient.split('.')[1]?.length ?? 0) - Number(exponent) };
  });
  const scale = Math.max(0, ...parts.map(part => part.scale)), unit = 10n ** BigInt(scale);
  const [p, c, m, k, carried] = parts.map(part => part.integer * 10n ** BigInt(scale - part.scale));
  const max = (a, b) => a > b ? a : b, min = (a, b) => a < b ? a : b;
  const adjustedUnits = p - carried, positive = max(0n, adjustedUnits), upperUnits = max(0n, c - m);
  // Partition on sorted breakpoints. The region above upper ALWAYS uses 85%.
  const lower = min(k, upperUnits), firstUnits = min(positive, lower), middleUnits = max(0n, min(positive - lower, upperUnits - lower)), lastUnits = max(0n, positive - upperUnits);
  const weighted = 95n * firstUnits + 90n * middleUnits + 85n * lastUnits;
  const decimal = value => Number(String(value) + 'e-' + scale);
  const adjusted = decimal(adjustedUnits), upper = decimal(upperUnits), first = decimal(firstUnits), middle = decimal(middleUnits), last = decimal(lastUnits);
  const raw = Number(String(weighted) + 'e-' + (scale + 2)), refund = Number(weighted / (100n * unit));
  return { profit_before_carry: profit, loss_brought_forward: loss, profit_after_carry: adjusted, loss_carried_forward: Math.max(0, -adjusted), threshold_85: upper, band95: first, band90: middle, band85: last, refund_raw: raw, refund, net_ltda_after_refund: capacity - refund, refund_above_capacity: Math.max(0, refund - capacity) };
}

export function policyCashflows(p) {
  const capex = finite(p.capex, 'capex', true), grant = finite(p.grant ?? 0, 'grant', true);
  if (grant > capex) throw new Error('grant exceeds CAPEX');
  const lag = p.refundLagYears ?? 1, grantYear = p.grantReceiptYear ?? 0;
  if (![lag, grantYear].every(v => Number.isInteger(v) && v >= 0)) throw new Error('nonnegative integer timing required');
  const spot = series(p.spotRevenues, null, 'spotRevenues'), n = spot.length;
  const balancing = series(p.balancingRevenues, n, 'balancingRevenues'), costs = series(p.variableCosts, n, 'variableCosts', true), capacity = series(p.capacityRevenues, n, 'capacityRevenues', true), ltda = series(p.ltdaCapacityRevenues, n, 'ltdaCapacityRevenues', true), main = series(p.annualMainCapacity, n, 'annualMainCapacity', true), capital = series(p.annualCapitalCost, n, 'annualCapitalCost', true), bid = series(p.bidVariableCosts, n, 'bidVariableCosts', true), opex = series(p.fixedOpex ?? 0, n, 'fixedOpex', true);
  if (capacity.some((v, i) => v > 0 && ltda[i] > 0)) throw new Error('same capacity-year double counted');
  let carried = 0;
  const details = spot.map((v, i) => {
    if (ltda[i] <= 0) return null;
    const result = ltdaRefund(v + balancing[i] - (costs[i] - bid[i]), ltda[i], main[i], capital[i], carried);
    carried = result.loss_carried_forward;
    return result;
  });
  const assessed = details.map(v => v?.refund ?? 0), horizon = Math.max(n + (assessed.some(v => v > 0) ? lag : 0), grantYear);
  const rows = [{ year: 0, grant_receipt: grantYear === 0 ? grant : 0, cashflow: -capex + (grantYear === 0 ? grant : 0) }];
  for (let year = 1; year <= horizon; year++) {
    const i = year - 1, active = i < n, paid = assessed[i - lag] ?? 0, receipt = year === grantYear ? grant : 0;
    const contribution = active ? spot[i] + balancing[i] + capacity[i] + ltda[i] - costs[i] - opex[i] : 0;
    rows.push({ year, spot: active ? spot[i] : 0, balancing: active ? balancing[i] : 0, variable_cost: active ? costs[i] : 0, fixed_opex: active ? opex[i] : 0, main_capacity: active ? capacity[i] : 0, ltda_capacity: active ? ltda[i] : 0, refund_assessed: assessed[i] ?? 0, refund_paid: paid, grant_receipt: receipt, accrual_contribution: contribution - (assessed[i] ?? 0), cashflow: contribution - paid + receipt });
  }
  return { rows, refund_details: details, cashflows: rows.map(v => v.cashflow), assumptions: { level: 'C', currency: 'JPY', tax: 'excluded', market_inputs: 'gross sales from one feasible dispatch; energy/variable cost deducted once', grant_receipt_year: grantYear, refund_lag_years: lag, timing: 'annual simplification; real monthly Sep-Aug payments and working-capital needs not modeled', refund_formula_source: 'ltda-2026-contract; Article 28; version 2026-09-02', same_capacity_double_count: 'rejected' } };
}
