export function resetForm(form) {
  form.reset();
}

export function syncFormWithQuery(form, values) {
  for (const [key, value] of Object.entries(values)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    field.value = value ?? "";
  }
}

export function readFormQuery(form, currentValues) {
  const query = { ...currentValues };
  const formData = new FormData(form);

  for (const [key, value] of formData.entries()) {
    query[key] = typeof value === "string" ? value.trim() : value;
  }

  query.page = 1;
  return query;
}

export function movePage(queryState, direction, pagination) {
  if (direction === "prev" && pagination?.hasPreviousPage) {
    queryState.page -= 1;
  }

  if (direction === "next" && pagination?.hasNextPage) {
    queryState.page += 1;
  }
}
