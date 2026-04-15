import React, { useEffect, useState } from "react";
import {
  AVATAR_PLACEHOLDER,
  fetchOwnerWishlistPage,
  fetchWishlistPage,
  formatDateTime,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  removeOwnerWishlistItem,
  removeWishlistItem,
  sendWishlistNotification,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  EmptyState,
  MessageText,
  PaginationBar,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

function SavedWishlistCard({ item, onRemove }) {
  const product = item.product || {};
  const wishlistProduct = {
    ...product,
    id: product.id || item.productId,
  };

  return (
    <ProductCard
      product={wishlistProduct}
      showWishlist
      isSaved
      onToggleWishlist={onRemove}
      actionLayout="icon-top"
    />
  );
}
const CURSOR_CONFIG = {
  wishlist: {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};
function WishlistWatcher({ wishlist, product, busyKey, onNotify, onRemove }) {
  const user = wishlist.user || {};
  const notifyBusy = busyKey === `notify:${wishlist.id}`;
  const removeBusy = busyKey === `remove-owner:${wishlist.id}`;

  return (
    <article className="wishlist-watcher">
      <div className="wishlist-watcher__profile">
        <img
          className="wishlist-watcher__avatar"
          src={user.avatarUrl || AVATAR_PLACEHOLDER}
          alt={user.name || "Wishlist user"}
        />
        <div className="wishlist-watcher__copy">
          <div className="wishlist-watcher__headline">
            <strong>{user.name || "Unknown user"}</strong>
          </div>
          <p className="compact-text">
            {user.city || "City not added"} | Role: {user.role || "user"}
          </p>
          <p className="compact-text">
            Saved on {formatDateTime(wishlist.createdAt)}
          </p>
        </div>
      </div>

      <div className="wishlist-watcher__actions">
        <button
          type="button"
          className="btn btn--secondary btn--small"
          onClick={() => onNotify(wishlist, product)}
          disabled={notifyBusy || removeBusy}
        >
          {notifyBusy
            ? "Sending..."
            : product.status === "available"
              ? "Notify Available"
              : "Send Update"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => onRemove(wishlist, product)}
          disabled={notifyBusy || removeBusy}
        >
          {removeBusy ? "Removing..." : "Remove"}
        </button>
      </div>
    </article>
  );
}

function OwnerWishlistCard({ product, busyKey, onNotify, onRemove }) {
  const watcherCount = Number(
    product?._count?.wishlists || product?.wishlists?.length || 0,
  );

  return (
    <article className="wishlist-owner-card">
      <ProductCard product={product} actionLayout="icon-top" />

      <div className="wishlist-owner-card__watchers">
        <div className="wishlist-owner-card__watchers-header">
          <h4>People waiting for this item</h4>
          <span className="tag">{watcherCount} saved</span>
        </div>

        <div className="list-stack">
          {product.wishlists?.map((wishlist) => (
            <WishlistWatcher
              key={wishlist.id}
              wishlist={wishlist}
              product={product}
              busyKey={busyKey}
              onNotify={onNotify}
              onRemove={onRemove}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

export function WishlistPage({ page }) {
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog, promptDialog } =
    useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [savedPage, setSavedPage] = useState(1);
  const [ownerPage, setOwnerPage] = useState(1);
  const [savedItems, setSavedItems] = useState([]);
  const [ownerProducts, setOwnerProducts] = useState([]);
  const [savedPagination, setSavedPagination] = useState(null);
  const [ownerPagination, setOwnerPagination] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingOwner, setLoadingOwner] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    document.title = "Wishlist | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      redirectToLogin();
      return;
    }

    if (!loading && user?.role === "admin") {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    async function loadSavedItems() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      setLoadingSaved(true);
      const result = await fetchWishlistPage({ page: savedPage, limit: 6 });

      if (!active) {
        return;
      }

      setLoadingSaved(false);

      if (!result.ok || !result.data?.success) {
        setSavedItems([]);
        setSavedPagination(null);
        showMessage(
          result.data?.message || "Unable to load your wishlist.",
          "error",
        );
        return;
      }

      setSavedItems(result.data.data?.wishlists || []);
      setSavedPagination(result.data.data?.pagination || null);
    }

    loadSavedItems();

    return () => {
      active = false;
    };
  }, [loading, savedPage, showMessage, user]);

  useEffect(() => {
    let active = true;

    async function loadOwnerInterest() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      setLoadingOwner(true);
      const result = await fetchOwnerWishlistPage({
        page: ownerPage,
        limit: 4,
      });

      if (!active) {
        return;
      }

      setLoadingOwner(false);

      if (!result.ok || !result.data?.success) {
        setOwnerProducts([]);
        setOwnerPagination(null);
        showMessage(
          result.data?.message ||
            "Unable to load wishlist interest for your listings.",
          "error",
        );
        return;
      }

      setOwnerProducts(result.data.data?.products || []);
      setOwnerPagination(result.data.data?.pagination || null);
    }

    loadOwnerInterest();

    return () => {
      active = false;
    };
  }, [loading, ownerPage, showMessage, user]);

  async function reloadSavedItems() {
    const result = await fetchWishlistPage({ page: savedPage, limit: 6 });
    if (!result.ok || !result.data?.success) {
      return;
    }

    setSavedItems(result.data.data?.wishlists || []);
    setSavedPagination(result.data.data?.pagination || null);
  }

  async function reloadOwnerInterest() {
    const result = await fetchOwnerWishlistPage({ page: ownerPage, limit: 4 });
    if (!result.ok || !result.data?.success) {
      return;
    }

    setOwnerProducts(result.data.data?.products || []);
    setOwnerPagination(result.data.data?.pagination || null);
  }

  async function handleRemoveSaved(productId) {
    const shouldRemove = await confirmDialog({
      title: "Remove saved item?",
      message: "This product will be removed from your wishlist.",
      confirmLabel: "Remove item",
      cancelLabel: "Keep item",
      tone: "danger",
    });
    if (!shouldRemove) {
      return;
    }

    setBusyKey(`saved:${productId}`);
    const result = await removeWishlistItem(productId);
    setBusyKey("");

    showMessage(
      result.data?.message || "Wishlist updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok) {
      return;
    }

    if (savedItems.length === 1 && (savedPagination?.page || 1) > 1) {
      setSavedPage((previous) => previous - 1);
      return;
    }

    await reloadSavedItems();
  }

  async function handleNotifyWishlist(wishlist, product) {
    const defaultMessage =
      product.status === "available"
        ? `${product.title} is available again and ready for rent.`
        : `${product.title} has a new update from the owner.`;
    const enteredMessage = await promptDialog({
      title: "Send wishlist update",
      message:
        "Add an optional message for this user. Leave it blank to send the default update.",
      fieldLabel: "Message",
      fieldPlaceholder: "Write an optional update",
      defaultValue: defaultMessage,
      confirmLabel: "Send update",
      cancelLabel: "Cancel",
    });

    if (enteredMessage === null) {
      return;
    }

    setBusyKey(`notify:${wishlist.id}`);
    const result = await sendWishlistNotification(wishlist.id, {
      message: enteredMessage.trim() || undefined,
    });
    setBusyKey("");

    showMessage(
      result.data?.message || "Wishlist notification updated.",
      result.ok ? "success" : "error",
    );
  }

  async function handleRemoveOwnerWishlist(wishlist, product) {
    const shouldRemove = await confirmDialog({
      title: "Remove wishlist alert?",
      message: `Remove ${wishlist.user?.name || "this user"} from alerts for ${product.title}?`,
      confirmLabel: "Remove alert",
      cancelLabel: "Keep alert",
      tone: "danger",
    });
    if (!shouldRemove) {
      return;
    }

    setBusyKey(`remove-owner:${wishlist.id}`);
    const result = await removeOwnerWishlistItem(wishlist.id);
    setBusyKey("");

    showMessage(
      result.data?.message || "Wishlist interest updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok) {
      return;
    }

    if (ownerProducts.length === 1 && (ownerPagination?.page || 1) > 1) {
      setOwnerPage((previous) => previous - 1);
      return;
    }

    await reloadOwnerInterest();
  }

  const savedCount = savedPagination?.totalItems || savedItems.length;
  const ownerListingCount = ownerPagination?.totalItems || ownerProducts.length;
  const visibleWatcherCount = ownerProducts.reduce(
    (total, product) =>
      total +
      Number(product?._count?.wishlists || product?.wishlists?.length || 0),
    0,
  );

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      activeNav="wishlist"
      cursorConfig={CURSOR_CONFIG[page]}
    >
      <MessageText message={message} id="wishlistMessage" />

      <section className="wishlist-sections">
        <article
          className={`surface-panel${savedItems.length ? "" : " surface-panel--empty-state"}`}
        >
          <SectionHeading title="Saved items" compact />
          <div
            className={`card-grid wishlist-saved-grid${savedItems.length ? "" : " is-empty"}`}
          >
            {savedItems.length ? (
              savedItems.map((item) => (
                <SavedWishlistCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveSaved}
                />
              ))
            ) : (
              <EmptyState
                message={
                  loadingSaved
                    ? "Loading your wishlist..."
                    : "You have not saved any items yet."
                }
              />
            )}
          </div>

          <PaginationBar
            pagination={savedPagination}
            onPrevious={() => setSavedPage((previous) => previous - 1)}
            onNext={() => setSavedPage((previous) => previous + 1)}
          />
        </article>

        {/* <article className="surface-panel">
          <SectionHeading
            eyebrow="Owner side"
            title="People waiting for my listings"
            compact
            linkHref="/html/profile.html?tab=notifications"
            linkLabel="Open notifications"
          /> */}

        {/* <div className="card-grid wishlist-owner-grid">
            {ownerProducts.length ? (
              ownerProducts.map((product) => (
                <OwnerWishlistCard
                  key={product.id}
                  product={product}
                  busyKey={busyKey}
                  onNotify={handleNotifyWishlist}
                  onRemove={handleRemoveOwnerWishlist}
                />
              ))
            ) : (
              <EmptyState
                message={
                  loadingOwner
                    ? "Loading owner wishlist interest..."
                    : "No one has saved your listings yet."
                }
              />
            )}
          </div> */}

        {/* <PaginationBar
            pagination={ownerPagination}
            onPrevious={() => setOwnerPage((previous) => previous - 1)}
            onNext={() => setOwnerPage((previous) => previous + 1)}
          /> */}
        {/* </article> */}
      </section>
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
    </SiteLayout>
  );
}
