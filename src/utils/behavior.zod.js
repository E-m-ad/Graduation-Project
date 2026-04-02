import zod from "zod";

const BEHAVIOR_ACTION_VALUES = [
  "view",
  "search",
  "wishlist",
  "rent",
  "review",
  "share",
  "click_recommendation",
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

const trackBehaviorSchema = zod
  .object({
    actionType: zod.enum(BEHAVIOR_ACTION_VALUES),
    productId: zod
      .string()
      .trim()
      .uuid("Valid product id is required")
      .optional(),
    categoryId: zod
      .string()
      .trim()
      .uuid("Valid category id is required")
      .optional(),
    searchQuery: optionalTrimmedString(
      zod
        .string()
        .min(1, "Search query cannot be empty")
        .max(500, "Search query must be at most 500 characters long"),
    ),
    sessionId: optionalTrimmedString(
      zod.string().max(100, "Session id must be at most 100 characters long"),
    ),
    deviceInfo: optionalTrimmedString(
      zod.string().max(200, "Device info must be at most 200 characters long"),
    ),
    metadata: zod.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.actionType === "search" && !data.searchQuery) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Search query is required for search actions",
        path: ["searchQuery"],
      });
    }

    if (
      data.actionType !== "search" &&
      data.productId === undefined &&
      data.categoryId === undefined
    ) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        message: "Product id or category id is required for this action",
        path: ["productId"],
      });
    }
  });

export default {
  BEHAVIOR_ACTION_VALUES,
  trackBehaviorSchema,
};
