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

const recommendationQuerySchema = zod.object({
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

const similarProductParamSchema = zod.object({
  productId: zod.string().trim().uuid("Valid product id is required"),
});

export default {
  recommendationQuerySchema,
  similarProductParamSchema,
};
