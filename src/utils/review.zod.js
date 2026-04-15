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

function requiredTrimmedString(schema) {
  return zod.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim();
  }, schema);
}

const ratingSchema = zod
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be at least 1")
  .max(5, "Rating must be at most 5");

const commentSchema = zod
  .string()
  .max(5000, "Comment must be at most 5000 characters long");

const replySchema = zod
  .string()
  .min(1, "Reply is required")
  .max(5000, "Reply must be at most 5000 characters long");

const reviewIdParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid review id is required"),
});

const productReviewParamSchema = zod.object({
  id: zod.string().trim().uuid("Valid product id is required"),
});

const createReviewSchema = zod.object({
  rentalId: zod.string().trim().uuid("Valid rental id is required"),
  rating: optionalInteger(ratingSchema),
  comment: optionalNullableTrimmedString(commentSchema),
}).refine((data) => data.rating !== undefined, {
  message: "Rating is required",
  path: ["rating"],
});

const updateReviewSchema = zod
  .object({
    rating: optionalInteger(ratingSchema),
    comment: optionalNullableTrimmedString(commentSchema),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

const replyToReviewSchema = zod.object({
  ownerReply: requiredTrimmedString(replySchema),
});

const reviewListQuerySchema = zod.object({
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

export default {
  createReviewSchema,
  productReviewParamSchema,
  replyToReviewSchema,
  reviewIdParamSchema,
  reviewListQuerySchema,
  updateReviewSchema,
};
