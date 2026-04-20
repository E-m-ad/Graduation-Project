import zod from "zod";

const PRODUCT_CONDITIONS = ["new", "like_new", "excellent", "good", "fair"];
const PRODUCT_STATUS_UPDATE_VALUES = [
  "available",
  "unavailable",
  "under_review",
  "suspended",
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

function optionalNumber(schema) {
  return zod.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue === "" ? undefined : Number(trimmedValue);
    }

    return value;
  }, schema.optional());
}

function optionalNullableNumber(schema) {
  return zod.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : Number(trimmedValue);
    }

    return value;
  }, schema.nullable().optional());
}

const positivePriceNumberSchema = zod
  .number()
  .positive("Price must be greater than zero")
  .finite("Price must be a valid number");

const createPriceSchema = optionalNumber(positivePriceNumberSchema);
const updatePriceSchema = optionalNullableNumber(positivePriceNumberSchema);

const baseProductStrings = {
  title: zod
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters long")
    .max(200, "Title must be at most 200 characters long"),
  description: zod
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters long")
    .max(5000, "Description must be at most 5000 characters long"),
};

const createProductSchema = zod
  .object({
    categoryId: zod.string().trim().uuid("Valid category id is required"),
    title: baseProductStrings.title,
    description: baseProductStrings.description,
    pricePerHour: createPriceSchema,
    pricePerDay: createPriceSchema,
    pricePerWeek: createPriceSchema,
    pricePerMonth: createPriceSchema,
    securityDeposit: optionalNumber(
      zod
        .number()
        .nonnegative("Security deposit cannot be negative")
        .finite("Security deposit must be a valid number"),
    ),
    locationAddress: optionalTrimmedString(
      zod.string().max(1000, "Address must be at most 1000 characters long"),
    ),
    city: optionalTrimmedString(
      zod
        .string()
        .min(2, "City must be at least 2 characters long")
        .max(100, "City must be at most 100 characters long"),
    ),
    latitude: optionalNumber(
      zod
        .number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90")
        .finite("Latitude must be a valid number"),
    ),
    longitude: optionalNumber(
      zod
        .number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180")
        .finite("Longitude must be a valid number"),
    ),
    condition: zod.enum(PRODUCT_CONDITIONS).optional(),
    minRentalPeriod: optionalNumber(
      zod
        .number()
        .int("Minimum rental period must be a whole number")
        .min(1, "Minimum rental period must be at least 1"),
    ),
    maxRentalPeriod: optionalNumber(
      zod
        .number()
        .int("Maximum rental period must be a whole number")
        .min(1, "Maximum rental period must be at least 1")
        .max(365, "Maximum rental period must be at most 365"),
    ),
    termsConditions: optionalTrimmedString(
      zod
        .string()
        .max(5000, "Terms and conditions must be at most 5000 characters long"),
    ),
    tags: zod
      .preprocess((value) => {
        if (value === undefined || value === null || value === "") {
          return [];
        }

        if (typeof value === "string") {
          return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }

        return value;
      }, zod.array(zod.string().trim().min(1).max(50)).max(20))
      .optional(),
  })
  .refine(
    (data) =>
      data.pricePerHour !== undefined ||
      data.pricePerDay !== undefined ||
      data.pricePerWeek !== undefined ||
      data.pricePerMonth !== undefined,
    {
      message: "At least one rental price must be provided",
      path: ["pricePerDay"],
    },
  )
  .refine(
    (data) =>
      data.minRentalPeriod === undefined ||
      data.maxRentalPeriod === undefined ||
      data.minRentalPeriod <= data.maxRentalPeriod,
    {
      message:
        "Minimum rental period cannot be greater than maximum rental period",
      path: ["maxRentalPeriod"],
    },
  );

const updateProductSchema = zod
  .object({
    categoryId: zod.string().trim().uuid("Valid category id is required").optional(),
    title: optionalTrimmedString(baseProductStrings.title),
    description: optionalTrimmedString(baseProductStrings.description),
    pricePerHour: updatePriceSchema,
    pricePerDay: updatePriceSchema,
    pricePerWeek: updatePriceSchema,
    pricePerMonth: updatePriceSchema,
    securityDeposit: optionalNumber(
      zod
        .number()
        .nonnegative("Security deposit cannot be negative")
        .finite("Security deposit must be a valid number"),
    ),
    locationAddress: optionalNullableTrimmedString(
      zod.string().max(1000, "Address must be at most 1000 characters long"),
    ),
    city: optionalNullableTrimmedString(
      zod
        .string()
        .min(2, "City must be at least 2 characters long")
        .max(100, "City must be at most 100 characters long"),
    ),
    latitude: optionalNullableNumber(
      zod
        .number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90")
        .finite("Latitude must be a valid number"),
    ),
    longitude: optionalNullableNumber(
      zod
        .number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180")
        .finite("Longitude must be a valid number"),
    ),
    condition: zod.enum(PRODUCT_CONDITIONS).optional(),
    minRentalPeriod: optionalNumber(
      zod
        .number()
        .int("Minimum rental period must be a whole number")
        .min(1, "Minimum rental period must be at least 1"),
    ),
    maxRentalPeriod: optionalNumber(
      zod
        .number()
        .int("Maximum rental period must be a whole number")
        .min(1, "Maximum rental period must be at least 1")
        .max(365, "Maximum rental period must be at most 365"),
    ),
    termsConditions: optionalNullableTrimmedString(
      zod
        .string()
        .max(5000, "Terms and conditions must be at most 5000 characters long"),
    ),
    tags: zod
      .preprocess((value) => {
        if (value === undefined) {
          return undefined;
        }

        if (value === null || value === "") {
          return [];
        }

        if (typeof value === "string") {
          return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }

        return value;
      }, zod.array(zod.string().trim().min(1).max(50)).max(20).optional()),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  })
  .refine(
    (data) =>
      data.minRentalPeriod === undefined ||
      data.maxRentalPeriod === undefined ||
      data.minRentalPeriod <= data.maxRentalPeriod,
    {
      message:
        "Minimum rental period cannot be greater than maximum rental period",
      path: ["maxRentalPeriod"],
    },
  );

const productIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid product id is required"),
});

const productImageParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid product id is required"),
  imgId: zod.string().trim().uuid("Valid image id is required"),
});

const updateProductStatusSchema = zod.object({
  status: zod.enum(PRODUCT_STATUS_UPDATE_VALUES),
});

const productChatQuerySchema = zod.object({
  conversationId: zod
    .string()
    .trim()
    .uuid("Valid conversation id is required")
    .optional(),
});

const productChatMessageCreateSchema = zod.object({
  conversationId: zod
    .string()
    .trim()
    .uuid("Valid conversation id is required")
    .optional(),
  message: zod
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message must be at most 4000 characters long"),
});

const moderationReplySchema = zod.object({
  reply: zod
    .string()
    .trim()
    .min(5, "Reply must be at least 5 characters long")
    .max(5000, "Reply must be at most 5000 characters long"),
});

export default {
  createProductSchema,
  moderationReplySchema,
  productChatMessageCreateSchema,
  productChatQuerySchema,
  productIdParamSchema,
  productImageParamSchema,
  updateProductSchema,
  updateProductStatusSchema,
};
