<script>
  (function () {
    var loaderRemoved = false;
    var loaderCursorCleanup = null;
    var LOADER_CURSOR_CONFIG = {
      enabled: true,
      color: "#ffffff",
      targetSelector: "body",
      activeSelectors: ["#app-boot-loader"],
      deactiveSelectors: [],
      trailLength: 100,
    };

    function enableLoaderCursor(options) {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return null;
      }

      var enabled = options && options.enabled !== undefined
        ? Boolean(options.enabled)
        : true;

      if (!enabled) {
        return null;
      }

      var prefersReducedMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var coarsePointer = window.matchMedia &&
        window.matchMedia("(pointer: coarse)").matches;

      if (prefersReducedMotion || coarsePointer) {
        return null;
      }

      var targetSelector = options.targetSelector || "body";
      var target = document.querySelector(targetSelector);
      if (!target) {
        return null;
      }

      var canvas = document.createElement("canvas");
      var context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      canvas.className = "canvas-cursor";
      canvas.setAttribute("aria-hidden", "true");
      target.appendChild(canvas);
      target.classList.add("has-canvas-cursor");

      var computedPosition = window.getComputedStyle(target).position;
      var previousInlinePosition = target.style.position;
      var shouldRestorePosition = computedPosition === "static";

      if (shouldRestorePosition) {
        target.style.position = "relative";
      }

      var activeSelectors = Array.isArray(options.activeSelectors)
        ? options.activeSelectors.filter(Boolean)
        : [options.activeSelectors].filter(Boolean);
      var inactiveSelectors = Array.isArray(options.deactiveSelectors)
        ? options.deactiveSelectors.filter(Boolean)
        : [options.deactiveSelectors].filter(Boolean);
      var color = options.color || "#ffffff";
      var trailLength = Math.max(1, Number(options.trailLength) || 100);

      var animationFrame = 0;
      var width = 0;
      var height = 0;
      var scale = 1;
      var trail = [];
      var pointer = {
        x: 0,
        y: 0,
        active: false,
      };

      function setCursorActive(nextActive) {
        target.classList.toggle("has-canvas-cursor-active", nextActive);
      }

      function resizeCanvas() {
        var bounds = target.getBoundingClientRect();
        width = Math.max(bounds.width, 1);
        height = Math.max(bounds.height, 1);
        scale = window.devicePixelRatio || 1;

        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
      }

      function addTrailPoint(x, y) {
        trail.unshift({
          x: x,
          y: y,
          alpha: 1.2,
          radius: 20,
        });

        if (trail.length > trailLength) {
          trail = trail.slice(0, trailLength);
        }
      }

      function isPointerInsideActiveSection(clientX, clientY) {
        var pointerElement = document.elementFromPoint(clientX, clientY);

        if (!pointerElement || !target.contains(pointerElement)) {
          return false;
        }

        var isInsideInactiveSection = inactiveSelectors.some(function (selector) {
          var matchedSection = pointerElement.closest(selector);
          return Boolean(matchedSection && target.contains(matchedSection));
        });

        if (isInsideInactiveSection) {
          return false;
        }

        if (!activeSelectors.length) {
          return true;
        }

        return activeSelectors.some(function (selector) {
          var matchedSection = pointerElement.closest(selector);
          return Boolean(matchedSection && target.contains(matchedSection));
        });
      }

      function handlePointerMove(event) {
        var bounds = target.getBoundingClientRect();
        var nextX = event.clientX - bounds.left;
        var nextY = event.clientY - bounds.top;
        var withinBounds =
          nextX >= 0 &&
          nextY >= 0 &&
          nextX <= bounds.width &&
          nextY <= bounds.height;
        var isActiveSection =
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
          x: pointer.x,
          y: pointer.y,
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

          for (var index = 1; index < trail.length - 1; index += 1) {
            var currentPoint = trail[index];
            var nextPoint = trail[index + 1];
            var midpointX = (currentPoint.x + nextPoint.x) / 2;
            var midpointY = (currentPoint.y + nextPoint.y) / 2;

            context.quadraticCurveTo(
              currentPoint.x,
              currentPoint.y,
              midpointX,
              midpointY,
            );
          }

          var lastPoint = trail[trail.length - 1];
          context.lineTo(lastPoint.x, lastPoint.y);
          context.strokeStyle = color;
          context.lineWidth = 2.5;
          context.lineCap = "round";
          context.lineJoin = "round";
          context.globalAlpha = 0.3;
          context.stroke();
        }

        trail = trail
          .map(function (point, index) {
            return {
              x: point.x,
              y: point.y,
              alpha: point.alpha * 0.9,
              radius: Math.max(1.5, point.radius * 1.06),
              weight: 1 - index / Math.max(trail.length, 1),
            };
          })
          .filter(function (point) {
            return point.alpha > 0.06;
          });

        for (var trailIndex = trail.length - 1; trailIndex >= 0; trailIndex -= 1) {
          var point = trail[trailIndex];

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

      return function cleanupLoaderCursor() {
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
    }

    function finishHide() {
      if (loaderRemoved) {
        return;
      }

      loaderRemoved = true;
      window.clearTimeout(delayedTimer);
      if (typeof loaderCursorCleanup === "function") {
        loaderCursorCleanup();
        loaderCursorCleanup = null;
      }
      document.body.classList.remove("app-shell-loading", "app-shell-delayed");
      document.body.classList.add("app-shell-ready");

      var loader = document.getElementById("app-boot-loader");
      if (!loader) {
        return;
      }

      window.setTimeout(function () {
        loader.remove();
      }, 500);
    }

    var delayedTimer = window.setTimeout(function () {
      document.body.classList.add("app-shell-delayed");
    }, 5000);
    loaderCursorCleanup = enableLoaderCursor(LOADER_CURSOR_CONFIG);

    window.__AIRentHideBootLoader = function () {
      finishHide();
    };
  })();
</script>
