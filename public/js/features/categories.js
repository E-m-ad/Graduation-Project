import { dom } from "../core/dom.js";
import { state } from "../core/state.js";
import { authedRequest } from "../services/api.js";
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatPlainNumber,
  parseBooleanString,
  renderAvatarOrImage,
  renderStateMessage,
  renderStatusBadge,
} from "../core/ui.js";
import {
  createDetailSection,
  openDetailDialog,
  showActionDialog,
} from "./dialogs.js";
import { setStatus } from "../core/shell-ui.js";

function findById(collection, id) {
  return (collection ?? []).find((item) => item.id === id) ?? null;
}

function buildCategoryDepthMap(categories) {
  const childrenByParent = new Map();

  for (const category of categories) {
    const key = category.parentId ?? "__root__";
    const currentChildren = childrenByParent.get(key) ?? [];
    currentChildren.push(category);
    childrenByParent.set(key, currentChildren);
  }

  const depthById = new Map();

  function visit(parentId, depth) {
    const key = parentId ?? "__root__";
    const children = childrenByParent.get(key) ?? [];

    for (const child of children) {
      depthById.set(child.id, depth);
      visit(child.id, depth + 1);
    }
  }

  visit(null, 0);
  return depthById;
}

function getCategoryDescendantIds(categories, categoryId) {
  const childrenByParent = new Map();

  for (const category of categories) {
    const key = category.parentId ?? "__root__";
    const currentChildren = childrenByParent.get(key) ?? [];
    currentChildren.push(category);
    childrenByParent.set(key, currentChildren);
  }

  const blockedIds = new Set([categoryId]);
  const queue = [categoryId];

  while (queue.length) {
    const currentId = queue.shift();
    const children = childrenByParent.get(currentId) ?? [];

    for (const child of children) {
      if (!blockedIds.has(child.id)) {
        blockedIds.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return blockedIds;
}

function populateCategoryParentOptions({
  selectedParentId = "",
  editingCategoryId = state.editingCategoryId,
} = {}) {
  const categories = state.data.categories ?? [];
  const blockedIds = editingCategoryId
    ? getCategoryDescendantIds(categories, editingCategoryId)
    : new Set();
  const depthById = buildCategoryDepthMap(categories);

  const options = categories
    .filter((category) => !blockedIds.has(category.id))
    .map((category) => {
      const depth = depthById.get(category.id) ?? 0;
      const prefix = depth > 0 ? `${"- ".repeat(depth)}` : "";
      const isSelected =
        (selectedParentId ?? "") === category.id ? " selected" : "";

      return `<option value="${escapeHtml(category.id)}"${isSelected}>${escapeHtml(
        `${prefix}${category.name ?? "Unnamed category"}`,
      )}</option>`;
    })
    .join("");

  dom.categoryParentId.innerHTML = `
    <option value="">No parent (top-level)</option>
    ${options}
  `;
}

export function resetCategoryEditor() {
  state.editingCategoryId = null;
  dom.categoryForm.reset();
  dom.categoryFormMode.textContent = "Category studio";
  dom.categoryFormTitle.textContent = "Create category";
  dom.categoryFormCopy.textContent =
    "Add marketplace categories, subcategories, icons, and sort priority from one admin workspace.";
  dom.categorySubmit.textContent = "Create category";
  dom.categoryCancel.hidden = true;
  dom.categoryForm.elements.namedItem("isActive").value = "true";
  populateCategoryParentOptions();
}

export function beginCategoryEdit(categoryId, { scroll = true } = {}) {
  const category = findById(state.data.categories, categoryId);
  if (!category) return;

  state.editingCategoryId = category.id;
  dom.categoryFormMode.textContent = "Category editor";
  dom.categoryFormTitle.textContent = `Edit ${category.name ?? "category"}`;
  dom.categoryFormCopy.textContent =
    "Adjust naming, hierarchy, icon, visibility, and sorting for this catalog node.";
  dom.categorySubmit.textContent = "Save changes";
  dom.categoryCancel.hidden = false;

  dom.categoryForm.elements.namedItem("name").value = category.name ?? "";
  dom.categoryForm.elements.namedItem("description").value =
    category.description ?? "";
  dom.categoryForm.elements.namedItem("iconUrl").value = category.iconUrl ?? "";
  dom.categoryForm.elements.namedItem("sortOrder").value =
    category.sortOrder ?? "";
  dom.categoryForm.elements.namedItem("isActive").value = category.isActive
    ? "true"
    : "false";

  populateCategoryParentOptions({
    selectedParentId: category.parentId ?? "",
    editingCategoryId: category.id,
  });

  if (scroll) {
    dom.categoryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function buildCategoryPayload() {
  const formData = new FormData(dom.categoryForm);
  const sortOrder = String(formData.get("sortOrder") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const iconUrl = String(formData.get("iconUrl") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  return {
    name,
    description: description || null,
    iconUrl: iconUrl || null,
    parentId: parentId || null,
    sortOrder: sortOrder === "" ? undefined : Number(sortOrder),
    isActive: parseBooleanString(
      String(formData.get("isActive") ?? "true"),
      true,
    ),
  };
}

function filterCategories(categories) {
  const search = state.queries.categories.search.trim().toLowerCase();
  const statusFilter = parseBooleanString(state.queries.categories.isActive);
  const levelFilter = state.queries.categories.level;

  return categories.filter((category) => {
    if (search) {
      const haystack = [
        category.name,
        category.description,
        category.parent?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (statusFilter !== undefined && category.isActive !== statusFilter) {
      return false;
    }

    if (levelFilter === "root" && category.parentId) {
      return false;
    }

    if (levelFilter === "child" && !category.parentId) {
      return false;
    }

    return true;
  });
}

function renderCategorySummary(allCategories, visibleCategories) {
  const metrics = [
    { label: "Visible now", value: formatPlainNumber(visibleCategories.length) },
    { label: "Total categories", value: formatPlainNumber(allCategories.length) },
    {
      label: "Active",
      value: formatPlainNumber(
        allCategories.filter((category) => category.isActive).length,
      ),
    },
    {
      label: "Top-level",
      value: formatPlainNumber(
        allCategories.filter((category) => !category.parentId).length,
      ),
    },
    {
      label: "Subcategories",
      value: formatPlainNumber(
        allCategories.filter((category) => category.parentId).length,
      ),
    },
    {
      label: "Linked products",
      value: formatPlainNumber(
        allCategories.reduce(
          (total, category) => total + Number(category?._count?.products ?? 0),
          0,
        ),
      ),
    },
  ];

  dom.categoriesSummary.innerHTML = metrics
    .map(
      (metric) => `
        <div class="metric-chip">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `,
    )
    .join("");

  dom.categoriesPageMeta.textContent = `${formatPlainNumber(
    visibleCategories.length,
  )} of ${formatPlainNumber(allCategories.length)} categories`;
}

function renderCategoryCard(category) {
  const icon = renderAvatarOrImage({
    src: category.iconUrl,
    label: category.name ?? "Category",
    className: "entity-thumb",
  });

  return `
    <article class="entity-card">
      <div class="entity-head">
        <div class="thumb-line">
          ${icon}
          <div>
            <div class="entity-title">${escapeHtml(category.name ?? "Unnamed category")}</div>
            <div class="muted">
              ${escapeHtml(
                category.parent?.name
                  ? `Parent: ${category.parent.name}`
                  : "Top-level category",
              )}
            </div>
          </div>
        </div>
        <div class="entity-actions">
          <button type="button" class="ghost" data-action="view-category" data-id="${escapeHtml(category.id)}">Details</button>
          <button type="button" class="ghost" data-action="edit-category" data-id="${escapeHtml(category.id)}">Edit</button>
          <button
            type="button"
            class="${category.isActive ? "warn" : ""}"
            data-action="toggle-category-status"
            data-id="${escapeHtml(category.id)}"
            data-next="${category.isActive ? "false" : "true"}"
          >
            ${category.isActive ? "Deactivate" : "Activate"}
          </button>
          <button type="button" class="warn" data-action="delete-category" data-id="${escapeHtml(category.id)}">Delete</button>
        </div>
      </div>
      <div class="entity-meta">
        ${renderStatusBadge(category.isActive ? "active" : "inactive")}
        <span class="pill">${escapeHtml(category.parentId ? "Subcategory" : "Top-level")}</span>
        <span>Sort ${escapeHtml(String(category.sortOrder ?? 0))}</span>
        <span>Updated ${escapeHtml(formatDate(category.updatedAt))}</span>
      </div>
      <p class="muted">${escapeHtml(category.description ?? "No description provided.")}</p>
      <div class="metric-grid">
        <div class="metric-chip">
          <span>Products</span>
          <strong>${escapeHtml(formatPlainNumber(category?._count?.products ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Children</span>
          <strong>${escapeHtml(formatPlainNumber(category?._count?.children ?? 0))}</strong>
        </div>
        <div class="metric-chip">
          <span>Created</span>
          <strong>${escapeHtml(formatDate(category.createdAt))}</strong>
        </div>
        <div class="metric-chip">
          <span>Icon</span>
          <strong>${escapeHtml(category.iconUrl ? "Linked" : "None")}</strong>
        </div>
      </div>
    </article>
  `;
}

export async function loadCategories() {
  const data = await authedRequest("/api/v1/categories");
  state.data.categories = data?.data?.categories ?? [];

  if (state.editingCategoryId) {
    const editingCategory = findById(
      state.data.categories,
      state.editingCategoryId,
    );
    if (editingCategory) {
      beginCategoryEdit(editingCategory.id, { scroll: false });
    } else {
      resetCategoryEditor();
    }
  } else {
    populateCategoryParentOptions();
  }

  const allCategories = state.data.categories ?? [];
  const visibleCategories = filterCategories(allCategories);

  renderCategorySummary(allCategories, visibleCategories);

  if (!visibleCategories.length) {
    dom.categoriesList.innerHTML = renderStateMessage(
      allCategories.length
        ? "No categories matched the current filters."
        : "No categories exist yet. Create the first category to structure the marketplace.",
    );
    return;
  }

  dom.categoriesList.innerHTML = visibleCategories
    .map(renderCategoryCard)
    .join("");
}

export async function viewCategoryDetails(id) {
  const data = await authedRequest(`/api/v1/categories/${id}`);
  const category = data?.data;

  if (!category) {
    throw new Error("Unable to load category details.");
  }

  const childrenContent = category.children?.length
    ? `
      <div class="detail-gallery">
        ${category.children
          .map(
            (child) => `
              <div class="detail-block">
                <strong>${escapeHtml(child.name ?? "Unnamed child")}</strong>
                <p class="muted">
                  ${escapeHtml(
                    `Sort ${child.sortOrder ?? 0} / ${child.isActive ? "Active" : "Inactive"}`,
                  )}
                </p>
              </div>
            `,
          )
          .join("")}
      </div>
    `
    : `<p class="muted">No child categories have been attached yet.</p>`;

  const iconPreview = category.iconUrl
    ? `
      <section class="detail-block">
        <h4>Icon</h4>
        <div class="detail-gallery">
          <img src="${escapeHtml(category.iconUrl)}" alt="${escapeHtml(category.name ?? "Category icon")}" />
        </div>
      </section>
    `
    : "";

  const content = `
    <div class="detail-grid">
      ${createDetailSection("Basics", [
        { label: "Name", value: category.name ?? "N/A" },
        { label: "Parent", value: category.parent?.name ?? "Top-level" },
        { label: "Status", value: category.isActive ? "Active" : "Inactive" },
        { label: "Sort order", value: String(category.sortOrder ?? 0) },
        { label: "Created", value: formatDateTime(category.createdAt) },
        { label: "Updated", value: formatDateTime(category.updatedAt) },
      ])}
      ${createDetailSection("Usage", [
        {
          label: "Child categories",
          value: String(category?._count?.children ?? 0),
        },
        {
          label: "Linked products",
          value: String(category?._count?.products ?? 0),
        },
        {
          label: "Level",
          value: category.parentId ? "Subcategory" : "Top-level",
        },
        { label: "Icon URL", value: category.iconUrl ?? "Not set" },
      ])}
    </div>
    <section class="detail-block">
      <h4>Description</h4>
      <p class="muted">${escapeHtml(category.description ?? "No description provided.")}</p>
    </section>
    <section class="detail-block">
      <h4>Children</h4>
      ${childrenContent}
    </section>
    ${iconPreview}
  `;

  openDetailDialog({
    kicker: "Category detail",
    title: category.name ?? "Category detail",
    content,
  });
}

export async function saveCategory() {
  const payload = buildCategoryPayload();
  const isEditing = Boolean(state.editingCategoryId);

  setStatus(
    "working",
    `${isEditing ? "Saving" : "Creating"} category ${payload.name || "draft"}...`,
  );

  await authedRequest(
    isEditing
      ? `/api/v1/categories/${state.editingCategoryId}`
      : "/api/v1/categories",
    {
      method: isEditing ? "PUT" : "POST",
      body: payload,
    },
  );

  resetCategoryEditor();
  await loadCategories();
  setStatus(
    "success",
    `${payload.name || "Category"} ${isEditing ? "updated" : "created"} successfully.`,
  );
}

export async function toggleCategoryStatus(id, nextValue) {
  const category = findById(state.data.categories, id);
  if (!category) return;

  const activate = nextValue === "true";
  const result = await showActionDialog({
    kicker: "Category status",
    title: activate ? "Activate category" : "Deactivate category",
    description: activate
      ? `Make ${category.name} available for new listings again.`
      : `Hide ${category.name} from active catalog operations without deleting it.`,
    confirmLabel: activate ? "Activate category" : "Deactivate category",
    confirmTone: activate ? "default" : "danger",
    showReasonField: false,
  });

  if (!result.confirmed) return;

  setStatus(
    "working",
    `${activate ? "Activating" : "Deactivating"} ${category.name}...`,
  );

  await authedRequest(`/api/v1/categories/${id}`, {
    method: "PUT",
    body: { isActive: activate },
  });

  await loadCategories();
  setStatus(
    "success",
    `${category.name} is now ${activate ? "active" : "inactive"}.`,
  );
}

export async function deleteCategory(id) {
  const category = findById(state.data.categories, id);
  if (!category) return;

  const result = await showActionDialog({
    kicker: "Delete category",
    title: `Delete ${category.name}?`,
    description:
      "This permanently removes the category if it has no child categories and no linked products.",
    confirmLabel: "Delete category",
    confirmTone: "danger",
    showReasonField: false,
  });

  if (!result.confirmed) return;

  setStatus("working", `Deleting ${category.name}...`);

  await authedRequest(`/api/v1/categories/${id}`, {
    method: "DELETE",
  });

  if (state.editingCategoryId === id) {
    resetCategoryEditor();
  }

  await loadCategories();
  setStatus("success", `${category.name} deleted successfully.`);
}
