const currencyFormatter = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const plainNumberFormatter = new Intl.NumberFormat("en");

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatCompactNumber(value) {
  return compactNumberFormatter.format(Number(value ?? 0));
}

export function formatDate(value) {
  if (!value) return "N/A";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "N/A";
  return dateTimeFormatter.format(new Date(value));
}

export function formatPercentage(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export function formatPlainNumber(value) {
  return plainNumberFormatter.format(Number(value ?? 0));
}

export function parseBooleanString(value, fallback = undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function pickPrimaryImage(record) {
  return (
    record?.images?.[0]?.thumbnailUrl || record?.images?.[0]?.imageUrl || ""
  );
}

export function buildQuery(path, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "AR";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function renderAvatarOrImage({
  src,
  label,
  className = "avatar-thumb",
}) {
  if (src) {
    return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" />`;
  }

  return `<div class="${className} pill">${escapeHtml(getInitials(label))}</div>`;
}

export function renderStatusBadge(value) {
  const normalized = String(value ?? "unknown")
    .toLowerCase()
    .replaceAll(/\s+/g, "_");

  return `<span class="status-badge ${normalized}">${escapeHtml(
    String(value ?? "unknown").replaceAll("_", " "),
  )}</span>`;
}

export function renderReadBadge(value) {
  return `<span class="status-badge ${value ? "read" : "unread"}">${
    value ? "Read" : "Unread"
  }</span>`;
}

export function renderRoleBadge(value) {
  return renderStatusBadge(value);
}

export function renderStateMessage(message) {
  return `<div class="state-message">${escapeHtml(message)}</div>`;
}

export function renderPagination(
  metaElement,
  prevButton,
  nextButton,
  pagination,
) {
  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const totalItems = pagination?.totalItems ?? 0;

  metaElement.textContent = `Page ${currentPage} of ${Math.max(totalPages, 1)} · ${totalItems} items`;
  prevButton.disabled = !pagination?.hasPreviousPage;
  nextButton.disabled = !pagination?.hasNextPage;
}
