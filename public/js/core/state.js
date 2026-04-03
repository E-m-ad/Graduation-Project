export const STORAGE_KEY = "ai-rent.admin-dashboard.access-token";

export const defaultNotificationQuery = () => ({
  page: 1,
  limit: 10,
  isRead: "",
  type: "",
});

export const defaultUserQuery = () => ({
  page: 1,
  limit: 8,
  search: "",
  role: "",
  isActive: "",
});

export const defaultCategoryQuery = () => ({
  search: "",
  isActive: "",
  level: "",
});

export const defaultProductQuery = () => ({
  page: 1,
  limit: 8,
  search: "",
  status: "",
  isApproved: "",
  city: "",
});

export const defaultRentalQuery = () => ({
  page: 1,
  limit: 8,
  search: "",
  status: "",
});

export const defaultReportQuery = () => ({
  days: 30,
  months: 6,
});

export const defaultDataState = () => ({
  overview: null,
  notificationPreview: null,
  users: null,
  categories: null,
  products: null,
  rentals: null,
  reports: null,
  notifications: null,
});

export const state = {
  accessToken: localStorage.getItem(STORAGE_KEY) ?? "",
  currentUser: null,
  activePanel: "overview",
  actionDialogResolver: null,
  editingCategoryId: null,
  queries: {
    notifications: defaultNotificationQuery(),
    users: defaultUserQuery(),
    categories: defaultCategoryQuery(),
    products: defaultProductQuery(),
    rentals: defaultRentalQuery(),
    reports: defaultReportQuery(),
  },
  data: defaultDataState(),
};

export const panelMeta = {
  overview: {
    kicker: "Operations",
    title: "Overview",
  },
  notifications: {
    kicker: "Inbox",
    title: "Notifications",
  },
  users: {
    kicker: "Access Control",
    title: "Users",
  },
  categories: {
    kicker: "Catalog Structure",
    title: "Categories",
  },
  products: {
    kicker: "Moderation",
    title: "Products",
  },
  rentals: {
    kicker: "Oversight",
    title: "Rentals",
  },
  reports: {
    kicker: "Analytics",
    title: "Reports",
  },
};
