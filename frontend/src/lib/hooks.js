import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredUser, loadCurrentUser, logout } from "./airent";

export function useSession({ refreshOnMount = true } = {}) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(refreshOnMount);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!refreshOnMount) {
        setLoading(false);
        return;
      }

      const nextUser = await loadCurrentUser();
      if (!active) {
        return;
      }

      setUser(nextUser);
      setLoading(false);
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [refreshOnMount]);

  async function refreshUser(force = true) {
    const nextUser = await loadCurrentUser(force);
    setUser(nextUser);
    return nextUser;
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    window.location.href = "/";
  }

  return {
    user,
    loading,
    setUser,
    refreshUser,
    logout: handleLogout,
  };
}

export function useMessageState(initialText = "", initialType = "") {
  const [message, setMessage] = useState({
    text: initialText,
    type: initialType,
  });

  const show = useCallback((text, type = "") => {
    setMessage({ text, type });
  }, []);

  return [message, show];
}

export function useActionDialog() {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(null);
        resolverRef.current = null;
      }
    };
  }, []);

  const closeDialog = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }

    setDialog(null);
  }, []);

  const openDialog = useCallback((options = {}) => {
    if (resolverRef.current) {
      resolverRef.current(null);
      resolverRef.current = null;
    }

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: options.mode || "confirm",
        title: options.title || "Confirm action",
        message: options.message || "",
        confirmLabel:
          options.confirmLabel ||
          (options.mode === "prompt" ? "Save" : "Confirm"),
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default",
        fieldLabel: options.fieldLabel || "",
        fieldPlaceholder: options.fieldPlaceholder || "",
        fieldValue:
          typeof options.defaultValue === "string" ? options.defaultValue : "",
        fieldRequired: Boolean(options.fieldRequired),
        fieldMultiline: options.fieldMultiline !== false,
      });
    });
  }, []);

  const confirmDialog = useCallback(
    (options = {}) =>
      openDialog({
        ...options,
        mode: "confirm",
      }),
    [openDialog],
  );

  const promptDialog = useCallback(
    (options = {}) =>
      openDialog({
        ...options,
        mode: "prompt",
      }),
    [openDialog],
  );

  return {
    dialog,
    setDialog,
    closeDialog,
    confirmDialog,
    promptDialog,
  };
}
// export function useCanvasCursor({
//   color = "#000000",
//   enabled = true,
//   targetSelector = "body",
//   trailLength = 70,
//   activeSelectors = [],
//   cursorOuterRadius = 10,
//   cursorRingRadius = 8,
//   cursorDotRadius = 2.5,
//   trailStartRadius = 10,
//   trailLineWidth = 1.5,
//   fadeSpeed = 0.9,
//   shrinkSpeed = 0.96,
// } = {}) {

export function useCanvasCursor(options = {}) {
  const {
    color = "#ffffff",
    enabled = true,
    targetSelector = "body",
    trailLength = 100,
    activeSelectors = [],
    deactiveSelectors = [],
  } = options;

  const legacyDeactiveSelectores =
    options.deactiveSelectores !== undefined
      ? options.deactiveSelectores
      : undefined;

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    if (!enabled) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;

    if (prefersReducedMotion || coarsePointer) {
      return undefined;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      return undefined;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    canvas.className = "canvas-cursor";
    canvas.setAttribute("aria-hidden", "true");
    target.appendChild(canvas);
    target.classList.add("has-canvas-cursor");

    const computedPosition = window.getComputedStyle(target).position;
    const previousInlinePosition = target.style.position;
    const shouldRestorePosition = computedPosition === "static";

    if (shouldRestorePosition) {
      target.style.position = "relative";
    }

    const normalizedActiveSelectors = Array.isArray(activeSelectors)
      ? activeSelectors.filter(Boolean)
      : [activeSelectors].filter(Boolean);
    const normalizedDeactiveSelectors = Array.isArray(deactiveSelectors)
      ? deactiveSelectors.filter(Boolean)
      : [deactiveSelectors].filter(Boolean);
    const normalizedDeactiveSelectores =
      legacyDeactiveSelectores === undefined
        ? []
        : Array.isArray(legacyDeactiveSelectores)
          ? legacyDeactiveSelectores.filter(Boolean)
          : [legacyDeactiveSelectores].filter(Boolean);
    const normalizedInactiveSelectors = [
      ...normalizedDeactiveSelectors,
      ...normalizedDeactiveSelectores,
    ];

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    let trail = [];
    let pointer = {
      x: 0,
      y: 0,
      active: false,
    };

    function setCursorActive(nextActive) {
      target.classList.toggle("has-canvas-cursor-active", nextActive);
    }

    function resizeCanvas() {
      const bounds = target.getBoundingClientRect();
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      scale = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    function addTrailPoint(x, y) {
      trail.unshift({
        x,
        y,
        alpha: 1.2,
        radius: 20,
      });

      if (trail.length > trailLength) {
        trail = trail.slice(0, trailLength);
      }
    }

    function isPointerInsideActiveSection(clientX, clientY) {
      const pointerElement = document.elementFromPoint(clientX, clientY);

      if (!pointerElement || !target.contains(pointerElement)) {
        return false;
      }

      const isInsideDeactiveSection = normalizedInactiveSelectors.some(
        (selector) => {
          const matchedSection = pointerElement.closest(selector);
          return Boolean(matchedSection && target.contains(matchedSection));
        },
      );

      if (isInsideDeactiveSection) {
        return false;
      }

      if (!normalizedActiveSelectors.length) {
        return true;
      }

      return normalizedActiveSelectors.some((selector) => {
        const matchedSection = pointerElement.closest(selector);
        return Boolean(matchedSection && target.contains(matchedSection));
      });
    }

    function handlePointerMove(event) {
      const bounds = target.getBoundingClientRect();
      const nextX = event.clientX - bounds.left;
      const nextY = event.clientY - bounds.top;
      const withinBounds =
        nextX >= 0 &&
        nextY >= 0 &&
        nextX <= bounds.width &&
        nextY <= bounds.height;
      const isActiveSection =
        withinBounds &&
        isPointerInsideActiveSection(event.clientX, event.clientY);

      pointer = {
        x: nextX,
        y: nextY,
        active: isActiveSection,
      };

      setCursorActive(isActiveSection);

      if (isActiveSection) {
        addTrailPoint(nextX, nextY);
      }
    }

    function handlePointerLeave() {
      pointer = {
        ...pointer,
        active: false,
      };
      setCursorActive(false);
    }

    function renderFrame() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(scale, 0, 0, scale, 0, 0);

      if (trail.length > 1) {
        context.beginPath();
        context.moveTo(trail[0].x, trail[0].y);

        for (let index = 1; index < trail.length - 1; index += 1) {
          const currentPoint = trail[index];
          const nextPoint = trail[index + 1];
          const midpointX = (currentPoint.x + nextPoint.x) / 2;
          const midpointY = (currentPoint.y + nextPoint.y) / 2;

          context.quadraticCurveTo(
            currentPoint.x,
            currentPoint.y,
            midpointX,
            midpointY,
          );
        }

        const lastPoint = trail[trail.length - 1];
        context.lineTo(lastPoint.x, lastPoint.y);
        context.strokeStyle = color;
        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.globalAlpha = 0.3;
        context.stroke();
      }

      trail = trail
        .map((point, index) => ({
          ...point,
          alpha: point.alpha * 0.9,
          radius: Math.max(1.5, point.radius * 1.06),
          weight: 1 - index / Math.max(trail.length, 1),
        }))
        .filter((point) => point.alpha > 0.06);

      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index];

        context.beginPath();
        context.arc(point.x, point.y, point.radius * 0.45, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = point.alpha * point.weight * 0.35;
        context.fill();
      }

      if (pointer.active) {
        context.beginPath();
        context.arc(pointer.x, pointer.y, 10, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = 0.1;
        context.fill();

        context.beginPath();
        context.arc(pointer.x, pointer.y, 15, 0, Math.PI * 2);
        context.strokeStyle = color;
        context.lineWidth = 1.25;
        context.globalAlpha = 0.35;
        context.stroke();

        context.beginPath();
        context.arc(pointer.x, pointer.y, 2.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.globalAlpha = 0.95;
        context.fill();
      }

      context.globalAlpha = 1;
      animationFrame = window.requestAnimationFrame(renderFrame);
    }

    resizeCanvas();
    renderFrame();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerMove);
    target.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerMove);
      target.removeEventListener("pointerleave", handlePointerLeave);
      setCursorActive(false);
      target.classList.remove("has-canvas-cursor");

      if (shouldRestorePosition) {
        target.style.position = previousInlinePosition;
      }

      canvas.remove();
    };
  }, [
    activeSelectors,
    color,
    deactiveSelectors,
    enabled,
    legacyDeactiveSelectores,
    targetSelector,
    trailLength,
  ]);
}
