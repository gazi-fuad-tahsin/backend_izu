import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "docs", "postman");

const collectionVariables = [
  ["serverUrl", "http://localhost:8001", "Local server base URL"],
  ["apiPrefix", "/api/v1", "Mounted API prefix from src/app.js"],
  ["baseUrl", "{{serverUrl}}{{apiPrefix}}", "Computed API base URL"],
  ["accessToken", "", "JWT access token returned by login"],
  ["refreshToken", "", "JWT refresh token returned by login"],
  ["userId", "", "Authenticated user id or latest created user id"],
  ["participantId", "", "Other chat participant user id"],
  ["providerUserId", "", "Provider user id"],
  ["categoryId", "", "Category id"],
  ["serviceId", "", "Service id"],
  ["bookingId", "", "Booking id"],
  ["chatId", "", "Chat id"],
  ["notificationId", "", "Notification id"],
  ["paymentIntentId", "", "Stripe PaymentIntent id"],
  ["userEmail", "user@example.com", "Sample end-user email"],
  ["providerEmail", "provider@example.com", "Sample provider email"],
  ["adminEmail", "admin@example.com", "Sample admin email"],
  ["userPassword", "Passw0rd!", "Sample password"],
  ["otp", "123456", "OTP value used in auth recovery flow"],
  ["language", "English", "Allowed values include English and Deutsch"],
  ["bookingTime", "2026-03-20T10:00:00.000Z", "ISO booking timestamp"],
  ["latitude", "23.8103", "Provider latitude"],
  ["longitude", "90.4125", "Provider longitude"],
  ["page", "1", "Pagination page"],
  ["limit", "10", "Pagination limit"],
  ["year", "2026", "Reporting year"],
  ["days", "7", "Recent activity filter. Allowed: 1 or 7"],
  ["timeFilter", "7days", "Top services filter. Use 7days or leave blank"],
  ["search", "clean", "Free-text history search"],
  ["messagesLimit", "30", "Message page size"],
  ["messagesBefore", "", "Message cursor: ObjectId or ISO date"],
  ["profileImagePath", "", "Local file path for profile image upload"],
  ["categoryImagePath", "", "Local file path for category image upload"],
  ["serviceThumbnailOnePath", "", "Local file path for service thumbnail 1"],
  ["serviceThumbnailTwoPath", "", "Local file path for service thumbnail 2"],
  ["serviceThumbnailThreePath", "", "Local file path for service thumbnail 3"],
  ["messageFileOnePath", "", "Local file path for message attachment 1"],
  ["messageFileTwoPath", "", "Local file path for message attachment 2"],
  ["stripeSignature", "", "Stripe signature header for webhook testing"],
];

const variableObjects = collectionVariables.map(([key, value, description]) => ({
  key,
  value,
  type: "string",
  description,
}));

const envValues = collectionVariables.map(([key, value, description]) => ({
  key,
  value,
  type: "default",
  enabled: true,
  description,
}));

const jsonBody = (payload) => ({
  mode: "raw",
  raw: JSON.stringify(payload, null, 2),
  options: {
    raw: {
      language: "json",
    },
  },
});

const formDataBody = (entries) => ({
  mode: "formdata",
  formdata: entries,
});

const rawBody = (content, language = "text") => ({
  mode: "raw",
  raw: content,
  options: {
    raw: {
      language,
    },
  },
});

const makeQuery = (params = []) =>
  params.map(({ key, value, description, disabled }) => ({
    key,
    value,
    ...(description ? { description } : {}),
    ...(disabled ? { disabled: true } : {}),
  }));

const makeUrl = (raw, query = []) => ({
  raw,
  ...(query.length ? { query: makeQuery(query) } : {}),
});

const testEvent = (lines) => ({
  listen: "test",
  script: {
    type: "text/javascript",
    exec: lines,
  },
});

const storeVarHelper = [
  "const setVar = (key, value) => {",
  "  if (value === undefined || value === null || value === '') return;",
  "  pm.collectionVariables.set(key, String(value));",
  "  if (pm.environment) pm.environment.set(key, String(value));",
  "};",
];

const requestItem = ({
  name,
  method,
  rawUrl,
  description,
  body,
  auth,
  headers = [],
  query = [],
  tests = [],
}) => {
  const header = [...headers];

  if (body?.mode === "raw" && !header.some((item) => item.key === "Content-Type")) {
    header.push({ key: "Content-Type", value: "application/json" });
  }

  return {
    name,
    ...(tests.length ? { event: [testEvent(tests)] } : {}),
    request: {
      method,
      header,
      ...(description ? { description } : {}),
      ...(auth ? { auth } : {}),
      url: makeUrl(rawUrl, query),
      ...(body ? { body } : {}),
    },
    response: [],
  };
};

const folder = (name, description, items) => ({
  name,
  ...(description ? { description } : {}),
  item: items,
});

const noAuth = { type: "noauth" };

const collection = {
  info: {
    name: "Backend Izu API",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description: [
      "Postman collection generated from the current Express route and controller code in this repository.",
      "",
      "Conventions:",
      "- All mounted API routes use `{{baseUrl}}`, which expands to `{{serverUrl}}{{apiPrefix}}`.",
      "- The collection uses bearer auth by default with `{{accessToken}}`.",
      "- Login, refresh, and several create endpoints store useful ids/tokens back into collection and environment variables.",
      "",
      "Codebase caveats reflected here:",
      "- `/auth/logout` and `/auth/change-password` are declared without auth middleware, but their controllers expect `req.user`. They are configured here with bearer auth because that is the only way they make sense semantically.",
      "- `POST /messages/:chatId/message` still validates `chatId` from the request body. This collection sends the same variable in both places.",
      "- `src/routes/stripe.webhook.route.js` exists, but it is not mounted under `src/app.js` or `config/route.config.js`. It is documented under `Internal` as an unmounted route.",
      "- Admin routes are authenticated, but no admin-only role middleware is currently applied in the route file.",
    ].join("\n"),
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
  },
  variable: variableObjects,
  item: [
    folder("System", "Top-level server routes outside `/api/v1`.", [
      requestItem({
        name: "Root Ping",
        method: "GET",
        rawUrl: "{{serverUrl}}/",
        auth: noAuth,
        description: "Public root route from `src/app.js`. No `/health` endpoint is mounted in the current codebase.",
      }),
    ]),
    folder("Auth", "Authentication and credential recovery flows.", [
      requestItem({
        name: "Register User",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/signup",
        auth: noAuth,
        description: "Creates a new user or provider account. `accountType` must be one of `user`, `provider`, or `admin`.",
        body: jsonBody({
          name: "Alex User",
          email: "{{userEmail}}",
          password: "{{userPassword}}",
          accountType: "user",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('userId', json?.data?.userId);",
        ],
      }),
      requestItem({
        name: "Login",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/login",
        auth: noAuth,
        description: "Authenticates a user and returns access and refresh tokens.",
        body: jsonBody({
          email: "{{userEmail}}",
          password: "{{userPassword}}",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('accessToken', json?.data?.accessToken);",
          "setVar('refreshToken', json?.data?.refreshToken);",
          "setVar('userId', json?.data?.userId);",
        ],
      }),
      requestItem({
        name: "Forgot Password",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/forgot-password",
        auth: noAuth,
        description: "Requests an OTP for password reset.",
        body: jsonBody({
          email: "{{userEmail}}",
        }),
      }),
      requestItem({
        name: "Verify OTP",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/verify-otp",
        auth: noAuth,
        description: "Validates the email and OTP pair.",
        body: jsonBody({
          email: "{{userEmail}}",
          otp: "{{otp}}",
        }),
      }),
      requestItem({
        name: "Reset Password",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/reset-password",
        auth: noAuth,
        description: "Resets the password using email plus OTP.",
        body: jsonBody({
          email: "{{userEmail}}",
          otp: "{{otp}}",
          newPassword: "NewPassw0rd!",
          confirmPassword: "NewPassw0rd!",
        }),
      }),
      requestItem({
        name: "Refresh Access Token",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/refresh-token",
        auth: noAuth,
        description: "Returns a new access token when given a valid refresh token.",
        body: jsonBody({
          refreshToken: "{{refreshToken}}",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('accessToken', json?.data?.accessToken);",
        ],
      }),
      requestItem({
        name: "Logout",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/logout",
        description: "Controller expects `req.user`, even though the route is currently declared without auth middleware. Send bearer auth here.",
      }),
      requestItem({
        name: "Change Password (Declared Auth Route)",
        method: "POST",
        rawUrl: "{{baseUrl}}/auth/change-password",
        description: "Declared in the route file, but the controller currently depends on `req.user` and references `httpStatus` without importing it. Use this as route documentation, not as a guaranteed working endpoint.",
        body: jsonBody({
          oldPassword: "{{userPassword}}",
          newPassword: "NewPassw0rd!",
        }),
      }),
    ]),
    folder("Profile", "Authenticated profile and account preferences endpoints.", [
      requestItem({
        name: "Get Profile",
        method: "GET",
        rawUrl: "{{baseUrl}}/profile",
        description: "Returns the authenticated profile for non-provider accounts.",
      }),
      requestItem({
        name: "Get Provider Profile",
        method: "GET",
        rawUrl: "{{baseUrl}}/profile/provider",
        description: "Returns provider profile details plus services and aggregated rating.",
      }),
      requestItem({
        name: "Update Profile",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/profile",
        description: "Multipart profile update. Add a local file path to `{{profileImagePath}}` if you want to upload an image.",
        body: formDataBody([
          { key: "name", value: "Alex", type: "text" },
          { key: "lastName", value: "User", type: "text" },
          { key: "email", value: "{{userEmail}}", type: "text" },
          { key: "phone", value: "+8801700000000", type: "text" },
          { key: "bio", value: "Experienced service customer", type: "text" },
          { key: "profileImage", type: "file", src: "{{profileImagePath}}" },
        ]),
      }),
      requestItem({
        name: "Update Language",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/profile/language",
        description: "Allowed values in the schema are `English` and `Deutsch`. The controller also contains an Arabic literal, but the model enum does not.",
        body: jsonBody({
          language: "{{language}}",
        }),
      }),
      requestItem({
        name: "Get Service History",
        method: "GET",
        rawUrl: "{{baseUrl}}/profile/service-history",
        description: "Returns grouped booking history for the authenticated user.",
        query: [
          { key: "search", value: "{{search}}", description: "Optional service-name filter", disabled: true },
        ],
      }),
      requestItem({
        name: "Change Password",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/profile/change-password",
        description: "Authenticated profile password change endpoint.",
        body: jsonBody({
          currentPassword: "{{userPassword}}",
          newPassword: "NewPassw0rd!",
          confirmPassword: "NewPassw0rd!",
        }),
      }),
    ]),
    folder("Categories", "Category management endpoints.", [
      requestItem({
        name: "Create Category",
        method: "POST",
        rawUrl: "{{baseUrl}}/categories",
        description: "Multipart category creation. Add a local file path to `{{categoryImagePath}}` for `catImage`.",
        body: formDataBody([
          { key: "name", value: "Home Cleaning", type: "text" },
          { key: "catImage", type: "file", src: "{{categoryImagePath}}" },
        ]),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('categoryId', json?.data?._id);",
        ],
      }),
      requestItem({
        name: "Get All Categories",
        method: "GET",
        rawUrl: "{{baseUrl}}/categories",
      }),
    ]),
    folder("Services", "Service catalogue and provider-owned service management.", [
      requestItem({
        name: "Create Service",
        method: "POST",
        rawUrl: "{{baseUrl}}/services",
        description: "Provider-only multipart endpoint. `serviceDetails` can be sent as a JSON string, which matches the controller logic.",
        body: formDataBody([
          { key: "category", value: "{{categoryId}}", type: "text" },
          {
            key: "serviceDetails",
            value: JSON.stringify(
              {
                title: "Deep Cleaning",
                serviceType: "hourly",
                hourlyPrice: 40,
                perSessionPrice: 120,
                details: "Detailed apartment cleaning service",
                isActive: true,
                address: "Downtown",
              },
              null,
              2
            ),
            type: "text",
          },
          { key: "serviceThumbnails", type: "file", src: "{{serviceThumbnailOnePath}}" },
          { key: "serviceThumbnails", type: "file", src: "{{serviceThumbnailTwoPath}}" },
          { key: "serviceThumbnails", type: "file", src: "{{serviceThumbnailThreePath}}" },
        ]),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('serviceId', json?.data?._id);",
        ],
      }),
      requestItem({
        name: "Get All And Popular Services",
        method: "GET",
        rawUrl: "{{baseUrl}}/services",
      }),
      requestItem({
        name: "Get Own Services",
        method: "GET",
        rawUrl: "{{baseUrl}}/services/own-services",
        description: "Returns services owned by the authenticated provider.",
      }),
      requestItem({
        name: "Get Service Details",
        method: "GET",
        rawUrl: "{{baseUrl}}/services/{{serviceId}}",
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('serviceId', json?.data?._id);",
          "setVar('providerUserId', json?.data?.providerId?._id || json?.data?.provider?._id || json?.data?.providerId);",
        ],
      }),
      requestItem({
        name: "Get Category Wise Services",
        method: "GET",
        rawUrl: "{{baseUrl}}/services/categoryWise/{{categoryId}}",
      }),
      requestItem({
        name: "Update Service",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/services/{{serviceId}}",
        description: "Multipart service update. Send only the fields you want to change.",
        body: formDataBody([
          { key: "category", value: "{{categoryId}}", type: "text" },
          {
            key: "serviceDetails",
            value: JSON.stringify(
              {
                title: "Deep Cleaning Premium",
                serviceType: "hourly",
                hourlyPrice: 45,
                details: "Updated service details",
              },
              null,
              2
            ),
            type: "text",
          },
          { key: "serviceThumbnails", type: "file", src: "{{serviceThumbnailOnePath}}" },
        ]),
      }),
      requestItem({
        name: "Delete Service",
        method: "DELETE",
        rawUrl: "{{baseUrl}}/services/delete/{{serviceId}}",
      }),
    ]),
    folder("Bookings", "Booking lifecycle endpoints for customers and providers.", [
      requestItem({
        name: "Create Booking",
        method: "POST",
        rawUrl: "{{baseUrl}}/bookings",
        description: "Creates a booking in `pending` state. For hourly bookings, `estimatedHours` multiplies the service hourly price.",
        body: jsonBody({
          serviceId: "{{serviceId}}",
          title: "Deep Cleaning Booking",
          bookingTime: "{{bookingTime}}",
          location: {
            type: "Point",
            coordinates: ["{{longitude}}", "{{latitude}}"],
            address: "Dhaka, Bangladesh",
          },
          estimatedHours: 2,
          bookingType: "hourly",
          extraNote: "Please bring your own supplies.",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('bookingId', json?.data?._id);",
        ],
      }),
      requestItem({
        name: "Cancel Booking",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/bookings/cancel/{{bookingId}}",
      }),
      requestItem({
        name: "Confirm Start Request",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/bookings/confirm/{{bookingId}}",
        description: "User-side confirmation when the provider asks to start the service.",
      }),
      requestItem({
        name: "Confirm Completion Request",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/bookings/confirm-completion/{{bookingId}}",
        description: "User-side confirmation when the provider asks to complete the service.",
      }),
      requestItem({
        name: "Submit Service Review",
        method: "POST",
        rawUrl: "{{baseUrl}}/bookings/review/{{bookingId}}",
        body: jsonBody({
          serviceId: "{{serviceId}}",
          rating: 5,
          message: "Excellent service.",
        }),
      }),
      requestItem({
        name: "Get Live Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/bookings/live",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
      requestItem({
        name: "Get Upcoming Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/bookings/upcoming",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
      requestItem({
        name: "Get Cancelled Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/bookings/cancelled",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
      requestItem({
        name: "Get Completed Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/bookings/completed",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
    ]),
    folder("Providers", "Provider workflow endpoints.", [
      requestItem({
        name: "Update Location",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/providers/location",
        body: rawBody('{\n  "latitude": {{latitude}},\n  "longitude": {{longitude}}\n}', "json"),
      }),
      requestItem({
        name: "Get Pending Requests",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/pending-requests",
      }),
      requestItem({
        name: "Accept Request",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/providers/accept-request/{{bookingId}}",
      }),
      requestItem({
        name: "Start Service",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/providers/start-service/{{bookingId}}",
      }),
      requestItem({
        name: "Cancel Request",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/providers/cancel-request/{{bookingId}}",
      }),
      requestItem({
        name: "Get Live Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/live-bookings",
      }),
      requestItem({
        name: "Get Upcoming Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/upcoming-bookings",
      }),
      requestItem({
        name: "Get Completed And Cancelled Bookings",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/completed-cancelled-bookings",
      }),
      requestItem({
        name: "Complete Booking",
        method: "PATCH",
        rawUrl: "{{baseUrl}}/providers/complete-booking/{{bookingId}}",
      }),
      requestItem({
        name: "Get Provider Stats",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/stats",
      }),
      requestItem({
        name: "Get Booking Location",
        method: "GET",
        rawUrl: "{{baseUrl}}/providers/{{bookingId}}/location",
      }),
    ]),
    folder("Messages", "Chat creation, attachments, and history.", [
      requestItem({
        name: "Create Chat",
        method: "POST",
        rawUrl: "{{baseUrl}}/messages/create",
        body: jsonBody({
          participantId: "{{participantId}}",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('chatId', json?.data?._id);",
        ],
      }),
      requestItem({
        name: "Send Message",
        method: "POST",
        rawUrl: "{{baseUrl}}/messages/{{chatId}}/message",
        description: "The route includes `:chatId`, but the controller also requires `chatId` in the body. This request sends both.",
        body: formDataBody([
          { key: "chatId", value: "{{chatId}}", type: "text" },
          { key: "content", value: "Hello from Postman", type: "text" },
          { key: "contentType", value: "text", type: "text" },
          { key: "files", type: "file", src: "{{messageFileOnePath}}" },
          { key: "files", type: "file", src: "{{messageFileTwoPath}}" },
        ]),
      }),
      requestItem({
        name: "Get Chats",
        method: "GET",
        rawUrl: "{{baseUrl}}/messages",
      }),
      requestItem({
        name: "Get Messages",
        method: "GET",
        rawUrl: "{{baseUrl}}/messages/{{chatId}}/messages",
        query: [
          { key: "limit", value: "{{messagesLimit}}" },
          { key: "before", value: "{{messagesBefore}}", disabled: true },
        ],
      }),
    ]),
    folder("Notifications", "Notification listing and read-state updates.", [
      requestItem({
        name: "Get Notifications",
        method: "GET",
        rawUrl: "{{baseUrl}}/notifications",
        query: [
          { key: "limit", value: "{{limit}}" },
          { key: "page", value: "{{page}}" },
        ],
      }),
      requestItem({
        name: "Get Admin Notifications",
        method: "GET",
        rawUrl: "{{baseUrl}}/notifications/admin",
      }),
      requestItem({
        name: "Mark Notification As Read",
        method: "PUT",
        rawUrl: "{{baseUrl}}/notifications/{{notificationId}}/read",
      }),
      requestItem({
        name: "Mark All Notifications As Read",
        method: "PUT",
        rawUrl: "{{baseUrl}}/notifications/read-all",
      }),
    ]),
    folder("Payments", "Stripe payment and provider onboarding endpoints.", [
      requestItem({
        name: "Create Payment Intent",
        method: "POST",
        rawUrl: "{{baseUrl}}/payments/create-payment",
        description: "Creates a Stripe PaymentIntent and stores a pending payment record. The response contains `clientSecret`; the test script extracts `paymentIntentId` automatically.",
        body: jsonBody({
          price: 80,
          bookingId: "{{bookingId}}",
          providerId: "{{providerUserId}}",
          paymentType: "booking",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "const clientSecret = json?.clientSecret || '';",
          "if (clientSecret.includes('_secret_')) {",
          "  setVar('paymentIntentId', clientSecret.split('_secret_')[0]);",
          "}",
        ],
      }),
      requestItem({
        name: "Confirm Payment",
        method: "POST",
        rawUrl: "{{baseUrl}}/payments/confirm-payment",
        description: "Confirms a successful PaymentIntent by id after Stripe completes the charge.",
        body: jsonBody({
          paymentIntentId: "{{paymentIntentId}}",
        }),
        tests: [
          ...storeVarHelper,
          "const json = pm.response.json();",
          "setVar('paymentIntentId', json?.paymentIntent?.id);",
        ],
      }),
      requestItem({
        name: "Create Stripe Connect Account",
        method: "POST",
        rawUrl: "{{baseUrl}}/payments/connect",
        description: "Creates or reuses an Express Stripe Connect account and returns the onboarding URL.",
      }),
    ]),
    folder("Admin", "Reporting and dashboard endpoints. The route file applies authentication, but no admin role restriction middleware.", [
      requestItem({
        name: "Get Statistics",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/statistics",
      }),
      requestItem({
        name: "Get Revenue By Month",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/revenue-by-month",
        query: [{ key: "year", value: "{{year}}" }],
      }),
      requestItem({
        name: "Get Recent Activity",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/recent-activity",
        query: [{ key: "days", value: "{{days}}", description: "Allowed values: 1 or 7" }],
      }),
      requestItem({
        name: "Get Top Services",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/top-services",
        query: [{ key: "timeFilter", value: "{{timeFilter}}", description: "Use `7days` or leave blank for all time", disabled: true }],
      }),
      requestItem({
        name: "Get User List",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/users",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
      requestItem({
        name: "Get Provider List",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/providers",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
      requestItem({
        name: "Get Commission Reports",
        method: "GET",
        rawUrl: "{{baseUrl}}/admin/commission-reports",
        query: [
          { key: "page", value: "{{page}}" },
          { key: "limit", value: "{{limit}}" },
        ],
      }),
    ]),
    folder("Internal", "Routes that exist in code but are not mounted as public API endpoints.", [
      requestItem({
        name: "Stripe Webhook (Unmounted)",
        method: "POST",
        rawUrl: "{{serverUrl}}/webhook",
        auth: noAuth,
        description: "Declared in `src/routes/stripe.webhook.route.js`, but not mounted under the main router. Keep this as internal documentation unless the route is wired into the app.",
        headers: [{ key: "Stripe-Signature", value: "{{stripeSignature}}" }],
        body: rawBody(
          JSON.stringify(
            {
              id: "evt_test_webhook",
              type: "account.updated",
              data: {
                object: {
                  id: "acct_test_123",
                  charges_enabled: true,
                  details_submitted: true,
                },
              },
            },
            null,
            2
          ),
          "json"
        ),
      }),
    ]),
  ],
};

const environment = {
  id: "backend-izu-local-environment",
  name: "Backend Izu Local",
  values: envValues,
  _postman_variable_scope: "environment",
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: "Codex",
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "Backend_Izu_API.postman_collection.json"),
  `${JSON.stringify(collection, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, "Backend_Izu_Local.postman_environment.json"),
  `${JSON.stringify(environment, null, 2)}\n`
);

console.log("Postman collection and environment generated in docs/postman");
