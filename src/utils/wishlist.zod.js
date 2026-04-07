import zod from "zod";

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

function optionalTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, schema.optional());
}

const wishlistProductParamSchema = zod.object({
  productId: zod.string().trim().uuid("Valid product id is required"),
});

const wishlistOwnerParamSchema = zod.object({
  wishlistId: zod.string().trim().uuid("Valid wishlist id is required"),
});

const wishlistListQuerySchema = zod.object({
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
});

const wishlistNotifyBodySchema = zod.object({
  title: optionalTrimmedString(
    zod
      .string()
      .min(3, "Title must be at least 3 characters long")
      .max(200, "Title must be at most 200 characters long"),
  ),
  message: optionalTrimmedString(
    zod
      .string()
      .min(3, "Message must be at least 3 characters long")
      .max(1000, "Message must be at most 1000 characters long"),
  ),
});

export default {
  wishlistListQuerySchema,
  wishlistNotifyBodySchema,
  wishlistOwnerParamSchema,
  wishlistProductParamSchema,
};
