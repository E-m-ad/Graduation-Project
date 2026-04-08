const productConditions = ["new", "like_new", "excellent", "good", "fair"];
const productStatuses = [
  "available",
  "rented",
  "unavailable",
  "under_review",
  "suspended",
];
const rentalPeriodTypes = ["hourly", "daily", "weekly", "monthly"];
const rentalStatuses = [
  "pending",
  "approved",
  "rejected",
  "active",
  "completed",
  "cancelled",
  "overdue",
];
const behaviorActions = [
  "view",
  "search",
  "wishlist",
  "rent",
  "review",
  "share",
  "click_recommendation",
];
const notificationTypes = [
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
const userRoles = ["renter", "owner", "both", "admin"];
const userStatuses = ["active", "suspended"];

const refSchema = (name) => ({ $ref: `#/components/schemas/${name}` });
const refResponse = (name) => ({ $ref: `#/components/responses/${name}` });
const jsonContent = (schema) => ({
  "application/json": {
    schema,
  },
});
const jsonRequestBody = (schema, required = true) => ({
  required,
  content: jsonContent(schema),
});
const multipartRequestBody = (schema, required = true) => ({
  required,
  content: {
    "multipart/form-data": {
      schema,
    },
  },
});
const uuidPathParameter = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: {
    type: "string",
    format: "uuid",
  },
});
const queryParameter = (name, schema, description) => ({
  name,
  in: "query",
  required: false,
  description,
  schema,
});

const bearerSecurity = [{ BearerAuth: [] }];
const refreshCookieSecurity = [{ RefreshTokenCookie: [] }];
const responseStatusMap = {
  BadRequest: "400",
  ValidationError: "400",
  Unauthorized: "401",
  Forbidden: "403",
  NotFound: "404",
  Conflict: "409",
  ServerError: "500",
};

function buildResponses(
  successStatus,
  successDescription,
  successSchemaName,
  extraResponses = [],
) {
  const responses = {
    [successStatus]: {
      description: successDescription,
      content: jsonContent(refSchema(successSchemaName)),
    },
  };

  for (const responseName of extraResponses) {
    responses[responseStatusMap[responseName]] = refResponse(responseName);
  }

  return responses;
}

function operation({
  tag,
  summary,
  description,
  security,
  parameters,
  requestBody,
  successStatus = 200,
  successDescription = "Success",
  successSchema = "GenericSuccessResponse",
  extraResponses = [],
}) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(security ? { security } : {}),
    ...(parameters?.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: buildResponses(
      successStatus,
      successDescription,
      successSchema,
      extraResponses,
    ),
  };
}

const paginationParameters = [
  queryParameter(
    "page",
    { type: "integer", minimum: 1 },
    "Page number",
  ),
  queryParameter(
    "limit",
    { type: "integer", minimum: 1, maximum: 50 },
    "Page size",
  ),
];

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Rental Marketplace API",
    version: "1.0.0",
    description:
      "API documentation for the rental marketplace backend. Most success responses follow `{ success, message?, data? }`. Protected routes use a Bearer access token. Refresh and logout use the `refreshToken` cookie created during login.",
  },
  servers: [
    {
      url: "/api/v1",
      description: "Current API server",
    },
  ],
  tags: [
    { name: "Auth" },
    { name: "Users" },
    { name: "Public Users" },
    { name: "Categories" },
    { name: "Products" },
    { name: "Rentals" },
    { name: "Reviews" },
    { name: "Wishlists" },
    { name: "Recommendations" },
    { name: "Behavior" },
    { name: "Notifications" },
    { name: "Admin" },
  ],
  paths: {
    "/auth/register": {
      post: operation({
        tag: "Auth",
        summary: "Register a user",
        description:
          "Creates an account and issues an email verification email. In development, the response also includes the raw verification token and link for local testing. The account must verify the email address before the first successful login.",
        requestBody: jsonRequestBody(refSchema("AuthRegisterRequest")),
        successStatus: 201,
        successDescription: "User registered successfully",
        successSchema: "AuthRegisterResponse",
        extraResponses: ["ValidationError", "ServerError"],
      }),
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Returns an access token and sets the `refreshToken` httpOnly cookie.",
        requestBody: jsonRequestBody(refSchema("LoginRequest")),
        responses: buildResponses(200, "Login successful", "LoginResponse", [
          "ValidationError",
          "Unauthorized",
          "Forbidden",
          "ServerError",
        ]),
      },
    },
    "/auth/refresh-token": {
      post: operation({
        tag: "Auth",
        summary: "Refresh access token",
        security: refreshCookieSecurity,
        successSchema: "RefreshTokenResponse",
        successDescription: "Access token refreshed",
        extraResponses: ["BadRequest", "Unauthorized", "ServerError"],
      }),
    },
    "/auth/logout": {
      post: operation({
        tag: "Auth",
        summary: "Log out",
        security: refreshCookieSecurity,
        successSchema: "MessageResponse",
        successDescription: "Logged out successfully",
        extraResponses: ["BadRequest", "ServerError"],
      }),
    },
    "/auth/forgot-password": {
      post: operation({
        tag: "Auth",
        summary: "Request password reset",
        requestBody: jsonRequestBody(refSchema("ForgotPasswordRequest")),
        successSchema: "ForgotPasswordResponse",
        successDescription: "Reset instructions issued",
        extraResponses: ["ValidationError", "ServerError"],
      }),
    },
    "/auth/request-email-verification": {
      post: operation({
        tag: "Auth",
        summary: "Send or resend verification email",
        description:
          "Accepts either an authenticated request for the current user or a public request with an email address. In development, the response includes the raw verification token and link for local testing.",
        requestBody: jsonRequestBody(refSchema("RequestEmailVerificationRequest"), false),
        successSchema: "EmailVerificationRequestResponse",
        successDescription: "Verification email issued successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/auth/verify-email": {
      post: operation({
        tag: "Auth",
        summary: "Verify email address",
        requestBody: jsonRequestBody(refSchema("VerifyEmailRequest")),
        successSchema: "EmailVerifiedResponse",
        successDescription: "Email verified successfully",
        extraResponses: ["ValidationError", "ServerError"],
      }),
    },
    "/auth/reset-password": {
      post: operation({
        tag: "Auth",
        summary: "Reset password",
        requestBody: jsonRequestBody(refSchema("ResetPasswordRequest")),
        successSchema: "MessageResponse",
        successDescription: "Password reset successfully",
        extraResponses: ["ValidationError", "ServerError"],
      }),
    },
    "/users/me": {
      get: operation({
        tag: "Users",
        summary: "Get my profile",
        security: bearerSecurity,
        extraResponses: ["Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
      put: operation({
        tag: "Users",
        summary: "Update my profile",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("UpdateProfileRequest")),
        successDescription: "Profile updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/users/change-password": {
      put: operation({
        tag: "Users",
        summary: "Change password",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("ChangePasswordRequest")),
        successSchema: "MessageResponse",
        successDescription: "Password changed successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/users/upload-avatar": {
      post: operation({
        tag: "Users",
        summary: "Upload avatar",
        description: "Accepts a single `avatar` image up to 2 MB.",
        security: bearerSecurity,
        requestBody: multipartRequestBody({
          type: "object",
          required: ["avatar"],
          properties: {
            avatar: {
              type: "string",
              format: "binary",
            },
          },
        }),
        successDescription: "Avatar updated successfully",
        extraResponses: ["BadRequest", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/public/users/{id}": {
      get: operation({
        tag: "Public Users",
        summary: "Get public user profile",
        parameters: [uuidPathParameter("id", "User id")],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/public/users/{id}/products": {
      get: operation({
        tag: "Public Users",
        summary: "Get public user products",
        parameters: [uuidPathParameter("id", "Owner user id")],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/public/users/{id}/reviews": {
      get: operation({
        tag: "Public Users",
        summary: "Get reviews for a user's products",
        parameters: [uuidPathParameter("id", "Owner user id")],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/categories": {
      get: operation({
        tag: "Categories",
        summary: "List categories",
        extraResponses: ["ServerError"],
      }),
      post: operation({
        tag: "Categories",
        summary: "Create category",
        description: "Admin only.",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("CategoryCreateRequest")),
        successStatus: 201,
        successDescription: "Category created successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/categories/{id}": {
      get: operation({
        tag: "Categories",
        summary: "Get category details",
        parameters: [uuidPathParameter("id", "Category id")],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
      put: operation({
        tag: "Categories",
        summary: "Update category",
        description: "Admin only.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Category id")],
        requestBody: jsonRequestBody(refSchema("CategoryUpdateRequest")),
        successDescription: "Category updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
      delete: operation({
        tag: "Categories",
        summary: "Delete category",
        description: "Admin only. Deletion fails when products still reference the category.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Category id")],
        successSchema: "MessageResponse",
        successDescription: "Category deleted successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/products": {
      get: operation({
        tag: "Products",
        summary: "List public products",
        parameters: [
          ...paginationParameters,
          queryParameter("search", { type: "string" }, "Search title and description"),
          queryParameter("city", { type: "string" }, "Filter by city"),
          queryParameter(
            "categoryId",
            { type: "string", format: "uuid" },
            "Filter by category id",
          ),
        ],
        extraResponses: ["BadRequest", "ServerError"],
      }),
      post: operation({
        tag: "Products",
        summary: "Create product listing",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("ProductCreateRequest")),
        successStatus: 201,
        successDescription: "Listing created successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/products/my-listings": {
      get: operation({
        tag: "Products",
        summary: "Get my listings",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter(
            "status",
            { type: "string", enum: productStatuses },
            "Optional listing status filter",
          ),
        ],
        extraResponses: ["BadRequest", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/products/{id}": {
      get: operation({
        tag: "Products",
        summary: "Get product details",
        description:
          "Public callers only receive approved visible products. Owners and admins can access their own moderated listings.",
        parameters: [uuidPathParameter("id", "Product id")],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
      put: operation({
        tag: "Products",
        summary: "Update product listing",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        requestBody: jsonRequestBody(refSchema("ProductUpdateRequest")),
        successDescription: "Listing updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
      delete: operation({
        tag: "Products",
        summary: "Delete product listing",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        successSchema: "MessageResponse",
        successDescription: "Listing deleted successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/products/{id}/status": {
      put: operation({
        tag: "Products",
        summary: "Update product status",
        description:
          "Owners can set `available` or `unavailable`. Admins can also use `under_review` and `suspended`.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        requestBody: jsonRequestBody(refSchema("ProductStatusUpdateRequest")),
        successDescription: "Listing status updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/products/{id}/images": {
      post: operation({
        tag: "Products",
        summary: "Upload product images",
        description: "Accepts up to 10 `images` files, each up to 5 MB.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        requestBody: multipartRequestBody({
          type: "object",
          required: ["images"],
          properties: {
            images: {
              type: "array",
              items: {
                type: "string",
                format: "binary",
              },
            },
          },
        }),
        successStatus: 201,
        successDescription: "Listing images uploaded successfully",
        extraResponses: ["BadRequest", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/products/{id}/images/{imgId}": {
      delete: operation({
        tag: "Products",
        summary: "Delete product image",
        security: bearerSecurity,
        parameters: [
          uuidPathParameter("id", "Product id"),
          uuidPathParameter("imgId", "Product image id"),
        ],
        successSchema: "MessageResponse",
        successDescription: "Listing image deleted successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/rentals": {
      post: operation({
        tag: "Rentals",
        summary: "Create rental request",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("RentalCreateRequest")),
        successStatus: 201,
        successDescription: "Rental request created successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/my-bookings": {
      get: operation({
        tag: "Rentals",
        summary: "Get renter bookings",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter(
            "status",
            { type: "string", enum: rentalStatuses },
            "Optional rental status filter",
          ),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/rentals/my-requests": {
      get: operation({
        tag: "Rentals",
        summary: "Get owner rental requests",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter(
            "status",
            { type: "string", enum: rentalStatuses },
            "Optional rental status filter",
          ),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/rentals/{id}": {
      get: operation({
        tag: "Rentals",
        summary: "Get rental details",
        description: "Accessible to the renter, owner, or an admin.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/rentals/{id}/approve": {
      put: operation({
        tag: "Rentals",
        summary: "Approve rental",
        description: "Owner-side action. No request body.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        successDescription: "Rental approved successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/{id}/reject": {
      put: operation({
        tag: "Rentals",
        summary: "Reject rental",
        description: "Owner-side action. Optional request body with `reason`.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        requestBody: jsonRequestBody(refSchema("RentalReasonRequest"), false),
        successDescription: "Rental rejected successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/{id}/cancel": {
      put: operation({
        tag: "Rentals",
        summary: "Cancel rental",
        description:
          "Renter, owner, or admin can cancel eligible rentals. Optional request body with `reason`.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        requestBody: jsonRequestBody(refSchema("RentalReasonRequest"), false),
        successDescription: "Rental cancelled successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/{id}/start": {
      put: operation({
        tag: "Rentals",
        summary: "Mark rental active",
        description: "Owner-side action. No request body.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        successDescription: "Rental marked as active successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/{id}/complete": {
      put: operation({
        tag: "Rentals",
        summary: "Mark rental completed",
        description: "Owner-side action. No request body.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Rental id")],
        successDescription: "Rental marked as completed successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/rentals/{id}/availability": {
      get: operation({
        tag: "Rentals",
        summary: "Check availability",
        description:
          "For this endpoint, the path parameter `id` is the product id, not the rental id.",
        parameters: [
          uuidPathParameter("id", "Product id"),
          queryParameter(
            "startDate",
            { type: "string", format: "date-time" },
            "Requested rental start date",
          ),
          queryParameter(
            "endDate",
            { type: "string", format: "date-time" },
            "Requested rental end date",
          ),
          queryParameter(
            "rentalPeriodType",
            { type: "string", enum: rentalPeriodTypes },
            "Optional period type",
          ),
          queryParameter(
            "quantity",
            { type: "integer", minimum: 1, maximum: 1 },
            "Current implementation supports only quantity `1`",
          ),
        ],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/reviews": {
      post: operation({
        tag: "Reviews",
        summary: "Create review",
        description: "Only the renter of a completed rental can create one review.",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("ReviewCreateRequest")),
        successStatus: 201,
        successDescription: "Review created successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/reviews/product/{id}": {
      get: operation({
        tag: "Reviews",
        summary: "Get reviews for a product",
        parameters: [
          uuidPathParameter("id", "Product id"),
          ...paginationParameters,
        ],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/reviews/{id}": {
      put: operation({
        tag: "Reviews",
        summary: "Update own review",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Review id")],
        requestBody: jsonRequestBody(refSchema("ReviewUpdateRequest")),
        successDescription: "Review updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
      delete: operation({
        tag: "Reviews",
        summary: "Delete own review",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Review id")],
        successSchema: "MessageResponse",
        successDescription: "Review deleted successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/reviews/{id}/reply": {
      put: operation({
        tag: "Reviews",
        summary: "Owner reply to review",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Review id")],
        requestBody: jsonRequestBody(refSchema("ReviewReplyRequest")),
        successDescription: "Reply added successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/wishlists": {
      get: operation({
        tag: "Wishlists",
        summary: "Get my wishlist",
        security: bearerSecurity,
        parameters: paginationParameters,
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/wishlists/{productId}": {
      post: {
        tags: ["Wishlists"],
        summary: "Add to wishlist",
        security: bearerSecurity,
        parameters: [uuidPathParameter("productId", "Product id")],
        responses: {
          200: {
            description: "Product already in wishlist",
            content: jsonContent(refSchema("GenericSuccessResponse")),
          },
          201: {
            description: "Product added to wishlist successfully",
            content: jsonContent(refSchema("GenericSuccessResponse")),
          },
          400: refResponse("ValidationError"),
          401: refResponse("Unauthorized"),
          403: refResponse("Forbidden"),
          404: refResponse("NotFound"),
          500: refResponse("ServerError"),
        },
      },
      delete: operation({
        tag: "Wishlists",
        summary: "Remove from wishlist",
        security: bearerSecurity,
        parameters: [uuidPathParameter("productId", "Product id")],
        successSchema: "MessageResponse",
        successDescription: "Product removed from wishlist successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/recommendations": {
      get: operation({
        tag: "Recommendations",
        summary: "Get personalized recommendations",
        security: bearerSecurity,
        parameters: paginationParameters,
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/recommendations/similar/{productId}": {
      get: operation({
        tag: "Recommendations",
        summary: "Get similar products",
        parameters: [
          uuidPathParameter("productId", "Product id"),
          ...paginationParameters,
        ],
        extraResponses: ["ValidationError", "NotFound", "ServerError"],
      }),
    },
    "/behavior/track": {
      post: operation({
        tag: "Behavior",
        summary: "Track behavior event",
        security: bearerSecurity,
        requestBody: jsonRequestBody(refSchema("BehaviorTrackRequest")),
        successStatus: 201,
        successDescription: "Behavior tracked successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/notifications": {
      get: operation({
        tag: "Notifications",
        summary: "Get notifications",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter("isRead", { type: "boolean" }, "Filter by read state"),
          queryParameter(
            "type",
            { type: "string", enum: notificationTypes },
            "Filter by notification type",
          ),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/notifications/{id}/read": {
      put: operation({
        tag: "Notifications",
        summary: "Mark notification read",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Notification id")],
        successDescription: "Notification marked as read successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/notifications/read-all": {
      put: operation({
        tag: "Notifications",
        summary: "Mark all read",
        security: bearerSecurity,
        successDescription: "All notifications marked as read successfully",
        extraResponses: ["Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/notifications/unread-count": {
      get: operation({
        tag: "Notifications",
        summary: "Get unread count",
        security: bearerSecurity,
        extraResponses: ["Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/admin/dashboard": {
      get: operation({
        tag: "Admin",
        summary: "Get dashboard statistics",
        description: "Admin only.",
        security: bearerSecurity,
        extraResponses: ["Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/admin/users": {
      get: operation({
        tag: "Admin",
        summary: "List users",
        description: "Admin only.",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter("search", { type: "string" }, "Search by name or email"),
          queryParameter("role", { type: "string", enum: userRoles }, "Filter by role"),
          queryParameter("isActive", { type: "boolean" }, "Filter by active state"),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/admin/users/{id}/status": {
      put: operation({
        tag: "Admin",
        summary: "Activate or suspend user",
        description: "Admin only. Accepts either `status` or `isActive`.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "User id")],
        requestBody: jsonRequestBody(refSchema("AdminUserStatusRequest")),
        successDescription: "User status updated successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "ServerError"],
      }),
    },
    "/admin/products": {
      get: operation({
        tag: "Admin",
        summary: "List all products",
        description: "Admin only. Includes hidden and unapproved products.",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter("search", { type: "string" }, "Search by title or description"),
          queryParameter("status", { type: "string", enum: productStatuses }, "Filter by status"),
          queryParameter("isApproved", { type: "boolean" }, "Filter by approval state"),
          queryParameter(
            "ownerId",
            { type: "string", format: "uuid" },
            "Filter by owner id",
          ),
          queryParameter(
            "categoryId",
            { type: "string", format: "uuid" },
            "Filter by category id",
          ),
          queryParameter("city", { type: "string" }, "Filter by city"),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/admin/products/{id}/approve": {
      put: operation({
        tag: "Admin",
        summary: "Approve listing",
        description: "Admin only. Optional request body with `reason`.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        requestBody: jsonRequestBody(refSchema("AdminModerationRequest"), false),
        successDescription: "Listing approved successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/admin/products/{id}/reject": {
      put: operation({
        tag: "Admin",
        summary: "Reject listing",
        description:
          "Admin only. Optional request body with `reason`. Current implementation rejects by suspending the product.",
        security: bearerSecurity,
        parameters: [uuidPathParameter("id", "Product id")],
        requestBody: jsonRequestBody(refSchema("AdminModerationRequest"), false),
        successDescription: "Listing rejected successfully",
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "NotFound", "Conflict", "ServerError"],
      }),
    },
    "/admin/rentals": {
      get: operation({
        tag: "Admin",
        summary: "List rentals",
        description: "Admin only.",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          queryParameter("search", { type: "string" }, "Search related users or product title"),
          queryParameter("status", { type: "string", enum: rentalStatuses }, "Filter by status"),
          queryParameter(
            "ownerId",
            { type: "string", format: "uuid" },
            "Filter by owner id",
          ),
          queryParameter(
            "renterId",
            { type: "string", format: "uuid" },
            "Filter by renter id",
          ),
          queryParameter(
            "productId",
            { type: "string", format: "uuid" },
            "Filter by product id",
          ),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
    "/admin/reports": {
      get: operation({
        tag: "Admin",
        summary: "Get reports",
        description: "Admin only. `days` controls aggregate lookback and `months` controls trend length.",
        security: bearerSecurity,
        parameters: [
          queryParameter("days", { type: "integer", minimum: 1, maximum: 365 }, "Lookback window"),
          queryParameter(
            "months",
            { type: "integer", minimum: 1, maximum: 24 },
            "Months in the trend series",
          ),
        ],
        extraResponses: ["ValidationError", "Unauthorized", "Forbidden", "ServerError"],
      }),
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      RefreshTokenCookie: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
      },
    },
    responses: {
      BadRequest: { description: "Bad request", content: jsonContent(refSchema("ErrorResponse")) },
      ValidationError: {
        description: "Validation failed",
        content: jsonContent(refSchema("ErrorResponse")),
      },
      Unauthorized: {
        description: "Authentication required or invalid token",
        content: jsonContent(refSchema("ErrorResponse")),
      },
      Forbidden: {
        description: "Authenticated but not allowed to perform the action",
        content: jsonContent(refSchema("ErrorResponse")),
      },
      NotFound: { description: "Resource not found", content: jsonContent(refSchema("ErrorResponse")) },
      Conflict: { description: "Business rule conflict", content: jsonContent(refSchema("ErrorResponse")) },
      ServerError: {
        description: "Internal server error",
        content: jsonContent(refSchema("ErrorResponse")),
      },
    },
    schemas: {
      MessageResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operation completed successfully" },
        },
      },
      GenericSuccessResponse: {
        type: "object",
        required: ["success"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", nullable: true },
          data: {
            type: "object",
            nullable: true,
            additionalProperties: true,
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Validation failed" },
          error: {
            type: "object",
            nullable: true,
            properties: {
              path: { type: "string", example: "email" },
              message: { type: "string", example: "Invalid email address" },
            },
          },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["success", "message", "accessToken"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Login successful" },
          accessToken: { type: "string" },
        },
      },
      RefreshTokenResponse: {
        type: "object",
        required: ["success", "accessToken"],
        properties: {
          success: { type: "boolean", example: true },
          accessToken: { type: "string" },
        },
      },
      ForgotPasswordResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: true },
          message: {
            type: "string",
            example:
              "If this email is registered, you will receive password reset instructions shortly",
          },
          resetToken: {
            type: "string",
            nullable: true,
            description: "Returned only in development mode by the current implementation.",
          },
        },
      },
      AuthRegisterResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: true },
          message: {
            type: "string",
            example: "User registered successfully. Check your email to verify your account.",
          },
          verificationToken: {
            type: "string",
            nullable: true,
            description: "Returned only in development mode for local verification testing.",
          },
          verificationLink: {
            type: "string",
            nullable: true,
            description: "Returned only in development mode for local verification testing.",
          },
        },
      },
      EmailVerificationRequestResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
          success: { type: "boolean", example: true },
          message: {
            type: "string",
            example: "Verification email sent successfully",
          },
          verificationToken: {
            type: "string",
            nullable: true,
            description: "Returned only in development mode for local verification testing.",
          },
          verificationLink: {
            type: "string",
            nullable: true,
            description: "Returned only in development mode for local verification testing.",
          },
        },
      },
      RequestEmailVerificationRequest: {
        type: "object",
        description:
          "Public callers provide `email`. Authenticated callers can omit the body and resend verification for the current account.",
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      AuthRegisterRequest: {
        type: "object",
        required: ["name", "email", "password", "confirmPassword"],
        properties: {
          name: { type: "string", minLength: 3 },
          email: { type: "string", format: "email" },
          password: {
            type: "string",
            minLength: 6,
            description: "Must contain at least one uppercase letter and one number.",
          },
          confirmPassword: { type: "string", minLength: 6 },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["token", "password", "confirmPassword"],
        properties: {
          token: { type: "string" },
          password: { type: "string", minLength: 6 },
          confirmPassword: { type: "string", minLength: 6 },
        },
      },
      VerifyEmailRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", minLength: 1 },
        },
      },
      EmailVerifiedResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Email verified successfully" },
          data: {
            type: "object",
            required: ["id", "email", "isVerified"],
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              isVerified: { type: "boolean", example: true },
            },
          },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        description: "Provide at least one field to update.",
        properties: {
          name: { type: "string", minLength: 3, maxLength: 100 },
          phone: { type: "string", description: "Egyptian phone number" },
          city: { type: "string", minLength: 10, maxLength: 100 },
          address: { type: "string", minLength: 10, maxLength: 200 },
          bio: { type: "string", maxLength: 200 },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword", "confirmNewPassword"],
        properties: {
          currentPassword: { type: "string", minLength: 6 },
          newPassword: {
            type: "string",
            minLength: 6,
            description: "Must contain at least one uppercase letter and one number.",
          },
          confirmNewPassword: { type: "string", minLength: 6 },
        },
      },
      CategoryCreateRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          description: { type: "string", maxLength: 5000, nullable: true },
          iconUrl: { type: "string", format: "uri", nullable: true },
          parentId: { type: "string", format: "uuid", nullable: true },
          sortOrder: { type: "integer", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
      CategoryUpdateRequest: {
        type: "object",
        description: "Provide at least one field to update.",
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          description: { type: "string", maxLength: 5000, nullable: true },
          iconUrl: { type: "string", format: "uri", nullable: true },
          parentId: { type: "string", format: "uuid", nullable: true },
          sortOrder: { type: "integer", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
      ProductCreateRequest: {
        type: "object",
        required: ["categoryId", "title", "description"],
        description: "At least one rental price must be provided.",
        properties: {
          categoryId: { type: "string", format: "uuid" },
          title: { type: "string", minLength: 3, maxLength: 200 },
          description: { type: "string", minLength: 10, maxLength: 5000 },
          pricePerHour: { type: "number", minimum: 0 },
          pricePerDay: { type: "number", minimum: 0 },
          pricePerWeek: { type: "number", minimum: 0 },
          pricePerMonth: { type: "number", minimum: 0 },
          securityDeposit: { type: "number", minimum: 0 },
          locationAddress: { type: "string", maxLength: 1000 },
          city: { type: "string", minLength: 2, maxLength: 100 },
          latitude: { type: "number", minimum: -90, maximum: 90 },
          longitude: { type: "number", minimum: -180, maximum: 180 },
          condition: { type: "string", enum: productConditions },
          minRentalPeriod: { type: "integer", minimum: 1 },
          maxRentalPeriod: { type: "integer", minimum: 1, maximum: 365 },
          termsConditions: { type: "string", maxLength: 5000 },
          tags: {
            type: "array",
            items: { type: "string", maxLength: 50 },
            maxItems: 20,
          },
        },
      },
      ProductUpdateRequest: {
        type: "object",
        description: "Provide at least one field to update.",
        properties: {
          categoryId: { type: "string", format: "uuid" },
          title: { type: "string", minLength: 3, maxLength: 200 },
          description: { type: "string", minLength: 10, maxLength: 5000 },
          pricePerHour: { type: "number", minimum: 0, nullable: true },
          pricePerDay: { type: "number", minimum: 0, nullable: true },
          pricePerWeek: { type: "number", minimum: 0, nullable: true },
          pricePerMonth: { type: "number", minimum: 0, nullable: true },
          securityDeposit: { type: "number", minimum: 0 },
          locationAddress: { type: "string", maxLength: 1000, nullable: true },
          city: { type: "string", minLength: 2, maxLength: 100, nullable: true },
          latitude: { type: "number", minimum: -90, maximum: 90, nullable: true },
          longitude: { type: "number", minimum: -180, maximum: 180, nullable: true },
          condition: { type: "string", enum: productConditions },
          minRentalPeriod: { type: "integer", minimum: 1 },
          maxRentalPeriod: { type: "integer", minimum: 1, maximum: 365 },
          termsConditions: { type: "string", maxLength: 5000, nullable: true },
          tags: {
            type: "array",
            items: { type: "string", maxLength: 50 },
            maxItems: 20,
          },
        },
      },
      ProductStatusUpdateRequest: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["available", "unavailable", "under_review", "suspended"],
          },
        },
      },
      RentalCreateRequest: {
        type: "object",
        required: ["productId", "startDate", "endDate", "rentalPeriodType"],
        properties: {
          productId: { type: "string", format: "uuid" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          rentalPeriodType: { type: "string", enum: rentalPeriodTypes },
          quantity: { type: "integer", minimum: 1, maximum: 1 },
          renterNotes: { type: "string", maxLength: 5000 },
        },
      },
      RentalReasonRequest: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 5000 },
        },
      },
      ReviewCreateRequest: {
        type: "object",
        required: ["rentalId", "rating"],
        properties: {
          rentalId: { type: "string", format: "uuid" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string", maxLength: 5000, nullable: true },
        },
      },
      ReviewUpdateRequest: {
        type: "object",
        description: "Provide at least one field to update.",
        properties: {
          rating: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string", maxLength: 5000, nullable: true },
        },
      },
      ReviewReplyRequest: {
        type: "object",
        required: ["ownerReply"],
        properties: {
          ownerReply: { type: "string", minLength: 1, maxLength: 5000 },
        },
      },
      BehaviorTrackRequest: {
        type: "object",
        required: ["actionType"],
        properties: {
          actionType: { type: "string", enum: behaviorActions },
          productId: { type: "string", format: "uuid" },
          categoryId: { type: "string", format: "uuid" },
          searchQuery: { type: "string", maxLength: 500 },
          sessionId: { type: "string", maxLength: 100 },
          deviceInfo: { type: "string", maxLength: 200 },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      AdminUserStatusRequest: {
        type: "object",
        description: "Provide either `status`, `isActive`, or both with matching values.",
        properties: {
          isActive: { type: "boolean" },
          status: { type: "string", enum: userStatuses },
          reason: { type: "string", maxLength: 5000 },
        },
      },
      AdminModerationRequest: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 5000 },
        },
      },
    },
  },
};

export default openApiDocument;
