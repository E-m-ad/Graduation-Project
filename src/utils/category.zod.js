import zod from "zod";

function optionalTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, schema.optional());
}

function optionalNullableTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  }, schema.nullable().optional());
}

function optionalInteger(schema) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue === "" ? undefined : Number(trimmedValue);
    }

    return value;
  }, schema.optional());
}

function optionalBoolean() {
  return zod.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      const normalizedValue = value.trim().toLowerCase();
      if (normalizedValue === "true") {
        return true;
      }

      if (normalizedValue === "false") {
        return false;
      }
    }

    return value;
  }, zod.boolean().optional());
}

function optionalNullableUuid(message) {
  return zod.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  }, zod.string().trim().uuid(message).nullable().optional());
}

const categoryNameSchema = zod
  .string()
  .trim()
  .min(2, "Category name must be at least 2 characters long")
  .max(100, "Category name must be at most 100 characters long");

const categoryDescriptionSchema = zod
  .string()
  .trim()
  .max(5000, "Category description must be at most 5000 characters long");

const categoryIconUrlSchema = zod
  .string()
  .trim()
  .url("Valid icon URL is required")
  .max(500, "Icon URL must be at most 500 characters long");

const categorySortOrderSchema = zod
  .number()
  .int("Sort order must be a whole number")
  .min(0, "Sort order cannot be negative");

const createCategorySchema = zod.object({
  name: categoryNameSchema,
  description: optionalNullableTrimmedString(categoryDescriptionSchema),
  iconUrl: optionalNullableTrimmedString(categoryIconUrlSchema),
  parentId: optionalNullableUuid("Valid parent category id is required"),
  sortOrder: optionalInteger(categorySortOrderSchema),
  isActive: optionalBoolean(),
});

const updateCategorySchema = zod
  .object({
    name: optionalTrimmedString(categoryNameSchema),
    description: optionalNullableTrimmedString(categoryDescriptionSchema),
    iconUrl: optionalNullableTrimmedString(categoryIconUrlSchema),
    parentId: optionalNullableUuid("Valid parent category id is required"),
    sortOrder: optionalInteger(categorySortOrderSchema),
    isActive: optionalBoolean(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

const categoryIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid category id is required"),
});

export default {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
};
