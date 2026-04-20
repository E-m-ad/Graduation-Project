import zod from "zod";

const RENTAL_PERIOD_TYPES = ["hourly", "daily", "weekly", "monthly"];
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

function coerceDate(message) {
  return zod
    .union([zod.string(), zod.number(), zod.date()])
    .transform((value, ctx) => {
      const parsedDate = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(parsedDate.getTime())) {
        ctx.addIssue({
          code: zod.ZodIssueCode.custom,
          message,
        });
        return zod.NEVER;
      }

      return parsedDate;
    });
}

const rentalIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid rental id is required"),
});

const productAvailabilityParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid product id is required"),
});

const quantitySchema = zod
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(1, "Only one item can be booked per rental request right now");

const createRentalSchema = zod
  .object({
    productId: zod.string().trim().uuid("Valid product id is required"),
    startDate: coerceDate("Valid rental start date is required"),
    endDate: coerceDate("Valid rental end date is required"),
    rentalPeriodType: zod.enum(RENTAL_PERIOD_TYPES),
    quantity: optionalInteger(quantitySchema),
    renterNotes: optionalTrimmedString(
      zod
        .string()
        .max(5000, "Renter notes must be at most 5000 characters long"),
    ),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Rental end date must be after the start date",
    path: ["endDate"],
  });

const rentalListQuerySchema = zod.object({
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
  status: optionalEnum(RENTAL_STATUS_VALUES),
  productId: optionalTrimmedString(
    zod.string().uuid("Valid product id is required"),
  ),
});

const availabilityQuerySchema = zod
  .object({
    startDate: coerceDate("Valid rental start date is required"),
    endDate: coerceDate("Valid rental end date is required"),
    rentalPeriodType: optionalEnum(RENTAL_PERIOD_TYPES),
    quantity: optionalInteger(quantitySchema),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: "Rental end date must be after the start date",
    path: ["endDate"],
  });

const rentalActionReasonSchema = zod.object({
  reason: optionalTrimmedString(
    zod.string().max(5000, "Reason must be at most 5000 characters long"),
  ),
});

const rentalMessageCreateSchema = zod.object({
  message: zod.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim();
  },
  zod
    .string()
    .min(1, "Message is required")
    .max(4000, "Message must be at most 4000 characters long")),
});

export default {
  availabilityQuerySchema,
  createRentalSchema,
  productAvailabilityParamSchema,
  rentalActionReasonSchema,
  rentalMessageCreateSchema,
  rentalIdParamSchema,
  rentalListQuerySchema,
  RENTAL_PERIOD_TYPES,
  RENTAL_STATUS_VALUES,
};
