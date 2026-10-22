// FCC Form 312 Schedule B page (private plan docs/plans/2026-10-21-001-feat-fcc-form-312-schedule-b-plan.md).
// The mesh (`kind: "dataset"`, `profile: "schedule-b"`) already carries one prebuilt row per earth
// station site, read by `noir schedb` from ICFS; this module only shapes rows for display, the filter
// chips, and the flattened export. Pure functions, so tests/check.js can call them directly.

const STATUS_BUCKETS = { granted: "granted", pending: "pending", expired: "expired" };
export const TYPE_LABELS = { individual: "Individual site", blanket: "Blanket", esim: "ESIM", other: "Other class" };
export const STATUS_LABELS = { granted: "Granted", pending: "Pending", expired: "Expired", closed: "Closed or dismissed" };

const fmt = (v, digits) => (v === null || v === undefined || v === "" ? "" : Number(v).toFixed(digits));
const num = (v) => (v === null || v === undefined || v === "" ? "" : String(v));

export function statusBucket(status) {
  return STATUS_BUCKETS[status] || "closed";
}

// A row that tripped a field check may carry a filing typo; it is shown as filed and marked for review.
export function needsReview(row) {
  return Boolean(row.needs_review || (row.flags && row.flags.length));
}

export function bandKey(b) {
  return `${b.lower_mhz}-${b.upper_mhz}`;
}

function rangeLabel(r) {
  return `${num(r.lower_mhz)}–${num(r.upper_mhz)} MHz ${r.tr}`.trim();
}

function rowBands(row, bands) {
  return bands.filter((b) => (row.band_ranges || []).some((r) => r.lower_mhz <= b.upper_mhz && r.upper_mhz >= b.lower_mhz));
}

// Display shape for one row: chip memberships, search haystack, and preformatted cells.
export function displayRow(row, bands) {
  const site = row.site || {};
  const bucket = statusBucket(row.status);
  const dirs = [...new Set((row.band_ranges || []).map((r) => r.tr).filter(Boolean))];
  const lists = [`type-${row.station_type}`, `status-${bucket}`, ...dirs.map((d) => `dir-${d}`),
                 ...rowBands(row, bands).map((b) => `band-${bandKey(b)}`),
                 ...(needsReview(row) ? ["review-needed"] : [])];
  const maxOf = (em, k) => {
    const v = em.map((e) => e[k]).filter((x) => x !== null && x !== undefined);
    return v.length ? Math.max(...v) : null;
  };
  // Per-band display fields for the detail table: the emission list and the per-carrier maxima.
  const ants = (row.antennas || []).map((a) => ({ ...a, bands: (a.bands || []).map((b) => {
    const em = b.emissions || [];
    return { ...b, emission_list: em.map((e) => e.emission).filter(Boolean).join(" "),
             max_eirp: maxOf(em, "eirp_dbw"), max_density: maxOf(em, "eirp_density") };
  }) }));
  const first = ants[0] || {};
  const filings = row.filings || [];
  const search = [row.applicant, row.callsign, row.frn, site.city, site.county, site.state, site.site_id,
    ...filings.map((f) => f.file_number), ...(row.emissions || []),
    ...ants.flatMap((a) => [a.manufacturer, a.model]),
    ...(row.points_of_communication || []).map((p) => p.name)]
    .filter(Boolean).join(" | ").toLowerCase().replace(/\s+/g, " ");
  const statusLabel = row.status === "granted" && row.has_pending ? "granted · filing pending"
    : row.status;
  return {
    ...row,
    antennas: ants,
    lists: lists.join(" "),
    review: needsReview(row),
    search,
    status_bucket: bucket,
    status_label: statusLabel,
    type_label: TYPE_LABELS[row.station_type] || row.station_type,
    location: [site.city, site.state].filter(Boolean).join(", "),
    coords: site.lat === null || site.lat === undefined ? "" : `${fmt(site.lat, 4)}, ${fmt(site.lon, 4)}`,
    ranges: (row.band_ranges || []).map(rangeLabel),
    first_lower: (row.band_ranges || [])[0] ? row.band_ranges[0].lower_mhz : "",
    // Every range the latest filing lists (in band or not), "lo:hi" in MHz, for the frequency box.
    filed_ranges: [...new Set(ants.flatMap((a) => a.bands)
      .filter((b) => b.lower_mhz !== null && b.lower_mhz !== undefined)
      .map((b) => `${b.lower_mhz}:${b.upper_mhz === null || b.upper_mhz === undefined ? b.lower_mhz : b.upper_mhz}`))].join(" "),
    antenna_label: first.diameter_m ? `${fmt(first.diameter_m, 2)} m${first.quantity && first.quantity > 1 ? ` × ${first.quantity}` : ""}` : "",
    antenna_model: [first.manufacturer, first.model].filter(Boolean).join(" "),
    more_antennas: Math.max(0, ants.length - 1),
    eirp: fmt(row.max_eirp_dbw, 1),
    filing_count: filings.length,
  };
}

// The chip groups the page renders: one per facet, only the values present, defaults marked.
export function chipGroups(rows, bands) {
  const present = (prefix) => new Set(rows.flatMap((r) => r.lists.split(" ").filter((l) => l.startsWith(prefix))));
  const types = present("type-");
  const statuses = present("status-");
  const dirs = present("dir-");
  const groups = [
    { name: "Type", key: "type", chips: Object.keys(TYPE_LABELS).filter((k) => types.has(`type-${k}`))
        // "Other class" (Form 312 class j, or an unrecognized code) is on by default: its sites may be fixed
        // stations, and hiding them by default understated the table (2026-10-22).
        .map((k) => ({ list: `type-${k}`, label: TYPE_LABELS[k], on: k === "individual" || k === "other" })) },
    { name: "Status", key: "status", chips: Object.keys(STATUS_LABELS).filter((k) => statuses.has(`status-${k}`))
        .map((k) => ({ list: `status-${k}`, label: STATUS_LABELS[k], on: k === "granted" || k === "pending" })) },
    { name: "Direction", key: "dir", chips: [["T", "Transmit"], ["R", "Receive"]].filter(([k]) => dirs.has(`dir-${k}`))
        .map(([k, label]) => ({ list: `dir-${k}`, label, on: false })) },
  ];
  if (rows.some((r) => r.review)) {
    groups.push({ name: "Review", key: "review", chips: [{ list: "review-needed", label: "Needs review", on: false }] });
  }
  if (bands.length > 1) {
    groups.push({ name: "Band", key: "band", chips: bands.map((b) => ({ list: `band-${bandKey(b)}`, label: b.label, on: false })) });
  }
  // A default that matches nothing would blank the table: drop defaults in a group with no present default.
  return groups.filter((g) => g.chips.length);
}

export const EXPORT_COLUMNS = [
  "site_id", "applicant", "frn", "callsign", "station_type", "class_of_station", "status", "has_pending",
  "grant_date", "expiration_date", "latest_file_number", "latest_filed", "latitude", "longitude", "elevation_m",
  "datum", "street", "city", "county", "state", "antenna_id", "antenna_quantity", "manufacturer", "model",
  "diameter_m", "height_agl_m", "height_amsl_m", "max_input_power_w", "antenna_max_eirp_dbw", "freq_lower_mhz",
  "freq_upper_mhz", "tr", "in_band", "gain_dbi", "polarization", "emissions", "max_eirp_dbw", "max_eirp_density",
  "points_of_communication", "freq_coord_required", "foreign_coord_required", "faa_notification",
  "comply_25209a", "needs_review", "flags", "icfs_url", "schedule_b_url",
];

// One line per site × antenna × frequency range, so the dataset sorts and filters by frequency.
export function exportLines(rows) {
  const out = [];
  for (const r of rows) {
    const s = r.site || {};
    const c = r.coordination || {};
    const base = {
      site_id: r.id, applicant: r.applicant, frn: r.frn, callsign: r.callsign, station_type: r.station_type,
      class_of_station: r.class_of_station, status: r.status, has_pending: r.has_pending ? "yes" : "no",
      grant_date: r.grant_date, expiration_date: r.expiration_date, latest_file_number: r.latest_file_number,
      latest_filed: r.latest_filed, latitude: num(s.lat), longitude: num(s.lon), elevation_m: num(s.elevation_m),
      datum: s.datum, street: s.street, city: s.city, county: s.county, state: s.state,
      points_of_communication: (r.points_of_communication || []).map((p) => p.name).join("; "),
      freq_coord_required: c.freq_coord_required, foreign_coord_required: c.foreign_coord_required,
      faa_notification: c.faa_notification, comply_25209a: c.comply_25209a,
      needs_review: needsReview(r) ? "yes" : "no", flags: (r.flags || []).join("; "), icfs_url: r.icfs_url, schedule_b_url: r.schedule_b_pdf_url,
    };
    const ants = r.antennas && r.antennas.length ? r.antennas : [{ bands: [] }];
    for (const a of ants) {
      const bandsOf = a.bands && a.bands.length ? a.bands : [{}];
      for (const b of bandsOf) {
        const em = b.emissions || [];
        const maxOf = (k) => {
          const v = em.map((e) => e[k]).filter((x) => x !== null && x !== undefined);
          return v.length ? String(Math.max(...v)) : "";
        };
        out.push({
          ...base, antenna_id: a.antenna_id || "", antenna_quantity: num(a.quantity), manufacturer: a.manufacturer || "",
          model: a.model || "", diameter_m: num(a.diameter_m), height_agl_m: num(a.height_agl_m),
          height_amsl_m: num(a.height_amsl_m), max_input_power_w: num(a.max_input_power_w),
          antenna_max_eirp_dbw: num(a.max_eirp_dbw), freq_lower_mhz: num(b.lower_mhz), freq_upper_mhz: num(b.upper_mhz),
          tr: b.tr || "", in_band: b.in_band ? "yes" : "no", gain_dbi: num(b.gain_dbi), polarization: b.polarization || "",
          emissions: em.map((e) => e.emission).filter(Boolean).join(" "),
          max_eirp_dbw: maxOf("eirp_dbw"), max_eirp_density: maxOf("eirp_density"),
        });
      }
    }
  }
  return out.map((line) => EXPORT_COLUMNS.map((k) => (line[k] === undefined || line[k] === null ? "" : line[k])));
}
