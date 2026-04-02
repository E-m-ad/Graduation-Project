import zod from "zod";

const USER_ROLE_VALUES = ["renter", "owner", "both", "admin"];
const USER_STATUS_VALUES = ["active", "suspended"];
const PRODUCT_STATUS_VALUES = [
  "available",
  "rented",
  "unavailable",
  "under_review",
  "suspended",
];
const RENTAL_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "active",
  "completed",
  "cancelled",
  "overdue",
];

function optionalTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, schema.optional());
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

function optionalBoolean(schema) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim().toLowerCase();

      if (trimmedValue === "true") {
        return true;
      }

      if (trimmedValue === "false") {
        return false;
      }
    }

    return value;
  }, schema.optional());
}

function optionalEnum(values) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue === "" ? undefined : trimmedValue;
    }

    return value;
  }, zod.enum(values).optional());
}

const paginationFields = {
  page: optionalInteger(
    zod
      .number()
      .int("Page must be a whole number")
      .min(1, "Page must be at least 1"),
  ),
  limit: optionalInteger(
    zod
      .number()
      .int("Limit must be a whole number")
      .min(1, "Limit must be at least 1")
      .max(50, "Limit must be at most 50"),
  ),
};

const userIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid user id is required"),
});

const productIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid product id is required"),
});

const adminUsersQuerySchema = zod.object({
  ...paginationFields,
  search: optionalTrimmedString(
    zod.string().max(255, "Search term must be at most 255 characters long"),
  ),
  role: optionalEnum(USER_ROLE_VALUES),
  isActive: optionalBoolean(zod.boolean()),
});

const adminUserStatusSchema = zod
  .object({
    isActive: optionalBoolean(zod.boolean()),
    status: optionalEnum(USER_STATUS_VALUES),
    reason: optionalTrimmedString(
      zod.string().max(5000, "Reason must be at most 5000 characters long"),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.isActive === undefined && data.status === undefined) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "User status is required",
        path: ["status"],
      });
    }

    if (
      data.isActive !== undefined &&
      data.status !== undefined &&
      data.isActive !== (data.status === "active")
    ) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "isActive does not match the supplied status value",
        path: ["isActive"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    isActive:
      data.isActive !== undefined ? data.isActive : data.status === "active",
  }));

const adminProductsQuerySchema = zod.object({
  ...paginationFields,
  search: optionalTrimmedString(
    zod.string().max(255, "Search term must be at most 255 characters long"),
  ),
  status: optionalEnum(PRODUCT_STATUS_VALUES),
  isApproved: optionalBoolean(zod.boolean()),
  ownerId: optionalTrimmedString(
    zod.string().uuid("Valid owner id is required"),
  ),
  categoryId: optionalTrimmedString(
    zod.string().uuid("Valid category id is required"),
  ),
  city: optionalTrimmedString(
    zod.string().max(100, "City must be at most 100 characters long"),
  ),
});

const adminProductModerationSchema = zod.object({
  reason: optionalTrimmedString(
    zod.string().max(5000, "Reason must be at most 5000 characters long"),
  ),
});

const adminRentalsQuerySchema = zod.object({
  ...paginationFields,
  search: optionalTrimmedString(
    zod.string().max(255, "Search term must be at most 255 characters long"),
  ),
  status: optionalEnum(RENTAL_STATUS_VALUES),
  ownerId: optionalTrimmedString(
    zod.string().uuid("Valid owner id is required"),
  ),
  renterId: optionalTrimmedString(
    zod.string().uuid("Valid renter id is required"),
  ),
  productId: optionalTrimmedString(
    zod.string().uuid("Valid product id is required"),
  ),
});

const adminReportsQuerySchema = zod.object({
  days: optionalInteger(
    zod
      .number()
      .int("Days must be a whole number")
      .min(1, "Days must be at least 1")
      .max(365, "Days must be at most 365"),
  ),
  months: optionalInteger(
    zod
      .number()
      .int("Months must be a whole number")
      .min(1, "Months must be at least 1")
      .max(24, "Months must be at most 24"),
  ),
});

export default {
  PRODUCT_STATUS_VALUES,
  RENTAL_STATUS_VALUES,
  USER_ROLE_VALUES,
  adminProductModerationSchema,
  adminProductsQuerySchema,
  adminRentalsQuerySchema,
  adminReportsQuerySchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  productIdParamSchema,
  userIdParamSchema,
};
