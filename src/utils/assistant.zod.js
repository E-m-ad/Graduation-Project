import zod from "zod";

function optionalTrimmedString(maxLength) {
  return zod.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, zod.string().max(maxLength).optional());
}

function optionalPositiveInteger(maxValue) {
  return zod.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const numericValue =
      typeof value === "string" ? Number(value.trim()) : Number(value);

    return Number.isFinite(numericValue) ? numericValue : value;
  }, zod.number().int().min(0).max(maxValue).optional());
}

const assistantHistoryMessageSchema = zod.object({
  role: zod.enum(["user", "assistant"]),
  content: zod
    .string()
    .trim()
    .min(1, "History message content cannot be empty")
    .max(4000, "History message content must be at most 4000 characters long"),
});

const assistantContextSchema = zod
  .object({
    page: optionalTrimmedString(60),
    pathname: optionalTrimmedString(500),
    pageTitle: optionalTrimmedString(160),
    productId: zod
      .string()
      .trim()
      .uuid("Valid product id is required")
      .optional(),
    productTitle: optionalTrimmedString(200),
    search: optionalTrimmedString(200),
    city: optionalTrimmedString(100),
    categoryName: optionalTrimmedString(100),
    resultsCount: optionalPositiveInteger(100000),
  })
  .optional();

const assistantChatSchema = zod.object({
  message: zod
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters long"),
  history: zod.array(assistantHistoryMessageSchema).max(12).optional(),
  context: assistantContextSchema,
});

export default {
  assistantChatSchema,
};
