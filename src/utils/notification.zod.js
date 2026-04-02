import zod from "zod";

const NOTIFICATION_TYPE_VALUES = [
  "rental_request",
  "rental_approved",
  "rental_rejected",
  "rental_started",
  "rental_ending_soon",
  "rental_completed",
  "rental_cancelled",
  "new_review",
  "review_reply",
  "recommendation",
  "system",
];

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

const notificationIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid notification id is required"),
});

const notificationListQuerySchema = zod.object({
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
  isRead: optionalBoolean(zod.boolean()),
  type: zod.enum(NOTIFICATION_TYPE_VALUES).optional(),
});

export default {
  NOTIFICATION_TYPE_VALUES,
  notificationIdParamSchema,
  notificationListQuerySchema,
};
