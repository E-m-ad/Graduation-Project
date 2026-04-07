import React, { useEffect, useState } from "react";
import {
  AVATAR_PLACEHOLDER,
  fetchOwnerWishlistPage,
  fetchWishlistPage,
  formatDateTime,
  getDefaultAuthenticatedPath,
  getPriceLabel,
  getPrimaryImage,
  redirectToLogin,
  removeOwnerWishlistItem,
  removeWishlistItem,
  sendWishlistNotification,
  truncateText,
} from "../lib/airent";
import { useMessageState, useSession } from "../lib/hooks";
import {
  EmptyState,
  MessageText,
  PaginationBar,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

function formatStatusLabel(status) {
  return String(status || "saved")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SavedWishlistCard({ item, busy, onRemove }) {
  const product = item.product || {};
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(
    product.id || item.productId,
  )}`;
  const imageUrl = getPrimaryImage(product);

  return (
    <article className="wishlist-saved-card">
      <a
        className="product-card__media wishlist-saved-card__media"
        href={detailsUrl}
        style={{
          "--product-card-media-image": `url(${JSON.stringify(imageUrl)})`,
        }}
      >
        <img
          className="product-card__image"
          src={imageUrl}
          alt={product.title || "Wishlist item"}
        />
      </a>

      <div className="wishlist-saved-card__body">
        <div className="wishlist-saved-card__meta">
          <span className="tag">{product.category?.name || "General"}</span>
          <span className="tag tag--light">
            {formatStatusLabel(product.status || "saved")}
          </span>
        </div>

        <div>
          <h3>
            <a href={detailsUrl}>{product.title || "Wishlist item"}</a>
          </h3>
          <p className="compact-text">
            {truncateText(product.description || "No description available.", 150)}
          </p>
        </div>

        <div className="wishlist-saved-card__stats">
          <span>{getPriceLabel(product)}</span>
          <span>{product.city || product.owner?.city || "Unknown city"}</span>
          <span>Saved {formatDateTime(item.createdAt)}</span>
          <span>Owner: {product.owner?.name || "Unknown owner"}</span>
        </div>

        <div className="listing-actions">
          <a className="btn btn--ghost btn--small" href={detailsUrl}>
            View Details
          </a>
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => onRemove(item.productId)}
            disabled={busy}
          >
            {busy ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </article>
  );
}

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
            {user.isVerified ? <span className="tag tag--light">Verified</span> : null}
          </div>
          <p className="compact-text">
            {user.city || "City not added"} | Role: {user.role || "user"}
          </p>
          <p className="compact-text">Saved on {formatDateTime(wishlist.createdAt)}</p>
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
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(product.id)}`;
  const imageUrl = getPrimaryImage(product);
  const watcherCount = Number(product?._count?.wishlists || product?.wishlists?.length || 0);

  return (
    <article className="wishlist-owner-card">
      <div className="wishlist-owner-card__top">
        <a
          className="product-card__media wishlist-owner-card__media"
          href={detailsUrl}
          style={{
            "--product-card-media-image": `url(${JSON.stringify(imageUrl)})`,
          }}
        >
          <img
            className="product-card__image"
            src={imageUrl}
            alt={product.title || "Listing image"}
          />
        </a>

        <div className="wishlist-owner-card__summary">
          <div className="wishlist-owner-card__meta">
            <span className="tag">{product.category?.name || "General"}</span>
            <span className="tag tag--light">
              {formatStatusLabel(product.status || "saved")}
            </span>
          </div>

          <div>
            <h3>
              <a href={detailsUrl}>{product.title || "Wishlist listing"}</a>
            </h3>
            <p className="compact-text">
              {truncateText(product.description || "No description available.", 160)}
            </p>
          </div>

          <div className="wishlist-owner-card__stats">
            <span>{getPriceLabel(product)}</span>
            <span>{product.city || "Unknown city"}</span>
            <span>{watcherCount} interested user{watcherCount === 1 ? "" : "s"}</span>
          </div>

          <a className="btn btn--ghost btn--small wishlist-owner-card__link" href={detailsUrl}>
            View Listing
          </a>
        </div>
      </div>

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
        showMessage(result.data?.message || "Unable to load your wishlist.", "error");
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
      const result = await fetchOwnerWishlistPage({ page: ownerPage, limit: 4 });

      if (!active) {
        return;
      }

      setLoadingOwner(false);

      if (!result.ok || !result.data?.success) {
        setOwnerProducts([]);
        setOwnerPagination(null);
        showMessage(
          result.data?.message || "Unable to load wishlist interest for your listings.",
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
    const shouldRemove = window.confirm(
      "Remove this item from your wishlist?",
    );
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
    const enteredMessage = window.prompt(
      "Optional message for this user. Leave it blank to send the default update.",
      defaultMessage,
    );

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
    const shouldRemove = window.confirm(
      `Remove ${wishlist.user?.name || "this user"} from alerts for ${product.title}?`,
    );
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
      total + Number(product?._count?.wishlists || product?.wishlists?.length || 0),
    0,
  );

  return (
    <SiteLayout page={page} user={user} onLogout={logout} activeNav="wishlist">
      <section className="page-hero">
        <div className="wishlist-hero">
          <div>
            <p className="eyebrow">Wishlist workspace</p>
            <h1>Track saved items and manage who is waiting for your listings.</h1>
            <p>
              Keep your saved products in one place, remove them whenever you want,
              and notify interested users when your item becomes available again.
            </p>
          </div>

          <div className="wishlist-summary">
            <article className="wishlist-stat">
              <strong>{savedCount}</strong>
              <span>Saved item{savedCount === 1 ? "" : "s"}</span>
            </article>
            <article className="wishlist-stat">
              <strong>{ownerListingCount}</strong>
              <span>Listing{ownerListingCount === 1 ? "" : "s"} with interest</span>
            </article>
            <article className="wishlist-stat">
              <strong>{visibleWatcherCount}</strong>
              <span>Interested user{visibleWatcherCount === 1 ? "" : "s"} on this view</span>
            </article>
          </div>
        </div>
      </section>

      <MessageText message={message} id="wishlistMessage" />

      <section className="wishlist-sections">
        <article className="surface-panel">
          <SectionHeading
            eyebrow="Renter side"
            title="My saved items"
            compact
            note="Anything you save from the marketplace appears here, and you can remove it at any time."
          />

          <div className="wishlist-saved-grid">
            {savedItems.length ? (
              savedItems.map((item) => (
                <SavedWishlistCard
                  key={item.id}
                  item={item}
                  busy={busyKey === `saved:${item.productId}`}
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

        <article className="surface-panel">
          <SectionHeading
            eyebrow="Owner side"
            title="People waiting for my listings"
            compact
            note="Notify interested users when an item becomes available, or remove a wishlist alert from your side."
            linkHref="/html/profile.html?tab=notifications"
            linkLabel="Open notifications"
          />

          <div className="wishlist-owner-grid">
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
          </div>

          <PaginationBar
            pagination={ownerPagination}
            onPrevious={() => setOwnerPage((previous) => previous - 1)}
            onNext={() => setOwnerPage((previous) => previous + 1)}
          />
        </article>
      </section>
    </SiteLayout>
  );
}
