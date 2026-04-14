/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => {
  // webpackBootstrap
  /******/ var __webpack_modules__ = {
    /***/ "./worker/index.js":
      /*!*************************!*\
  !*** ./worker/index.js ***!
  \*************************/
      /***/ (module, __unused_webpack_exports, __webpack_require__) => {
        eval(
          __webpack_require__.ts(
            '/* global self */ self.addEventListener("push", (event)=>{\n    let data = {};\n    try {\n        data = event.data ? event.data.json() : {};\n    } catch  {\n    /* ignore */ }\n    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "PlanSync";\n    const body = typeof data.body === "string" ? data.body : undefined;\n    const url = typeof data.url === "string" && (data.url.startsWith("http") || data.url.startsWith("/")) ? data.url : `${self.location.origin}/`;\n    event.waitUntil(self.registration.showNotification(title, {\n        body,\n        data: {\n            url\n        },\n        icon: "/icons/icon-192.png",\n        badge: "/icons/icon-192.png"\n    }));\n});\nself.addEventListener("notificationclick", (event)=>{\n    event.notification.close();\n    const raw = event.notification.data && event.notification.data.url;\n    let targetUrl = `${self.location.origin}/`;\n    if (typeof raw === "string" && raw.trim()) {\n        const t = raw.trim();\n        if (t.startsWith("http://") || t.startsWith("https://")) {\n            try {\n                const u = new URL(t);\n                if (u.origin === self.location.origin) targetUrl = u.href;\n            } catch  {\n            /* keep default */ }\n        } else if (t.startsWith("/") && !t.startsWith("//")) {\n            targetUrl = `${self.location.origin}${t}`;\n        }\n    }\n    event.waitUntil((async ()=>{\n        const clientsArr = await self.clients.matchAll({\n            type: "window",\n            includeUncontrolled: true\n        });\n        const targetOrigin = new URL(targetUrl).origin;\n        for (const client of clientsArr){\n            try {\n                if (new URL(client.url).origin !== targetOrigin) continue;\n                await client.focus();\n                if (typeof client.navigate === "function") {\n                    try {\n                        await client.navigate(targetUrl);\n                        return;\n                    } catch  {\n                    /* fall through */ }\n                }\n                return;\n            } catch  {\n                continue;\n            }\n        }\n        await self.clients.openWindow(targetUrl);\n    })());\n});\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we\'re in a\n        // browser context before continuing.\n        if (typeof self !== \'undefined\' &&\n            // No-JS mode does not inject these helpers:\n            \'$RefreshHelpers$\' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we\'ll check if it\'s\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                /* unsupported import.meta.webpackHot */ undefined.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we\'ll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it\'s possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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WyIvVXNlcnMvYWJlZGFhcmFiaS9EZXNrdG9wL2NvZGUvcGxhbnN5bmMvZnJvbnRlbmQvd29ya2VyL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBzZWxmICovXG5cbnNlbGYuYWRkRXZlbnRMaXN0ZW5lcihcInB1c2hcIiwgKGV2ZW50KSA9PiB7XG4gIGxldCBkYXRhID0ge307XG4gIHRyeSB7XG4gICAgZGF0YSA9IGV2ZW50LmRhdGEgPyBldmVudC5kYXRhLmpzb24oKSA6IHt9O1xuICB9IGNhdGNoIHtcbiAgICAvKiBpZ25vcmUgKi9cbiAgfVxuICBjb25zdCB0aXRsZSA9XG4gICAgdHlwZW9mIGRhdGEudGl0bGUgPT09IFwic3RyaW5nXCIgJiYgZGF0YS50aXRsZS50cmltKCkgPyBkYXRhLnRpdGxlLnRyaW0oKSA6IFwiUGxhblN5bmNcIjtcbiAgY29uc3QgYm9keSA9IHR5cGVvZiBkYXRhLmJvZHkgPT09IFwic3RyaW5nXCIgPyBkYXRhLmJvZHkgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHVybCA9XG4gICAgdHlwZW9mIGRhdGEudXJsID09PSBcInN0cmluZ1wiICYmIChkYXRhLnVybC5zdGFydHNXaXRoKFwiaHR0cFwiKSB8fCBkYXRhLnVybC5zdGFydHNXaXRoKFwiL1wiKSlcbiAgICAgID8gZGF0YS51cmxcbiAgICAgIDogYCR7c2VsZi5sb2NhdGlvbi5vcmlnaW59L2A7XG5cbiAgZXZlbnQud2FpdFVudGlsKFxuICAgIHNlbGYucmVnaXN0cmF0aW9uLnNob3dOb3RpZmljYXRpb24odGl0bGUsIHtcbiAgICAgIGJvZHksXG4gICAgICBkYXRhOiB7IHVybCB9LFxuICAgICAgaWNvbjogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsXG4gICAgICBiYWRnZTogXCIvaWNvbnMvaWNvbi0xOTIucG5nXCIsXG4gICAgfSksXG4gICk7XG59KTtcblxuc2VsZi5hZGRFdmVudExpc3RlbmVyKFwibm90aWZpY2F0aW9uY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gIGV2ZW50Lm5vdGlmaWNhdGlvbi5jbG9zZSgpO1xuICBjb25zdCByYXcgPSBldmVudC5ub3RpZmljYXRpb24uZGF0YSAmJiBldmVudC5ub3RpZmljYXRpb24uZGF0YS51cmw7XG4gIGxldCB0YXJnZXRVcmwgPSBgJHtzZWxmLmxvY2F0aW9uLm9yaWdpbn0vYDtcbiAgaWYgKHR5cGVvZiByYXcgPT09IFwic3RyaW5nXCIgJiYgcmF3LnRyaW0oKSkge1xuICAgIGNvbnN0IHQgPSByYXcudHJpbSgpO1xuICAgIGlmICh0LnN0YXJ0c1dpdGgoXCJodHRwOi8vXCIpIHx8IHQuc3RhcnRzV2l0aChcImh0dHBzOi8vXCIpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1ID0gbmV3IFVSTCh0KTtcbiAgICAgICAgaWYgKHUub3JpZ2luID09PSBzZWxmLmxvY2F0aW9uLm9yaWdpbikgdGFyZ2V0VXJsID0gdS5ocmVmO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGtlZXAgZGVmYXVsdCAqL1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodC5zdGFydHNXaXRoKFwiL1wiKSAmJiAhdC5zdGFydHNXaXRoKFwiLy9cIikpIHtcbiAgICAgIHRhcmdldFVybCA9IGAke3NlbGYubG9jYXRpb24ub3JpZ2lufSR7dH1gO1xuICAgIH1cbiAgfVxuXG4gIGV2ZW50LndhaXRVbnRpbChcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2xpZW50c0FyciA9IGF3YWl0IHNlbGYuY2xpZW50cy5tYXRjaEFsbCh7XG4gICAgICAgIHR5cGU6IFwid2luZG93XCIsXG4gICAgICAgIGluY2x1ZGVVbmNvbnRyb2xsZWQ6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHRhcmdldE9yaWdpbiA9IG5ldyBVUkwodGFyZ2V0VXJsKS5vcmlnaW47XG4gICAgICBmb3IgKGNvbnN0IGNsaWVudCBvZiBjbGllbnRzQXJyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKG5ldyBVUkwoY2xpZW50LnVybCkub3JpZ2luICE9PSB0YXJnZXRPcmlnaW4pIGNvbnRpbnVlO1xuICAgICAgICAgIGF3YWl0IGNsaWVudC5mb2N1cygpO1xuICAgICAgICAgIGlmICh0eXBlb2YgY2xpZW50Lm5hdmlnYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IGNsaWVudC5uYXZpZ2F0ZSh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgLyogZmFsbCB0aHJvdWdoICovXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGF3YWl0IHNlbGYuY2xpZW50cy5vcGVuV2luZG93KHRhcmdldFVybCk7XG4gICAgfSkoKSxcbiAgKTtcbn0pO1xuIl0sIm5hbWVzIjpbInNlbGYiLCJhZGRFdmVudExpc3RlbmVyIiwiZXZlbnQiLCJkYXRhIiwianNvbiIsInRpdGxlIiwidHJpbSIsImJvZHkiLCJ1bmRlZmluZWQiLCJ1cmwiLCJzdGFydHNXaXRoIiwibG9jYXRpb24iLCJvcmlnaW4iLCJ3YWl0VW50aWwiLCJyZWdpc3RyYXRpb24iLCJzaG93Tm90aWZpY2F0aW9uIiwiaWNvbiIsImJhZGdlIiwibm90aWZpY2F0aW9uIiwiY2xvc2UiLCJyYXciLCJ0YXJnZXRVcmwiLCJ0IiwidSIsIlVSTCIsImhyZWYiLCJjbGllbnRzQXJyIiwiY2xpZW50cyIsIm1hdGNoQWxsIiwidHlwZSIsImluY2x1ZGVVbmNvbnRyb2xsZWQiLCJ0YXJnZXRPcmlnaW4iLCJjbGllbnQiLCJmb2N1cyIsIm5hdmlnYXRlIiwib3BlbldpbmRvdyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./worker/index.js\n',
          ),
        );

        /***/
      },

    /******/
  };
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ if (cachedModule.error !== undefined) throw cachedModule.error;
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ id: moduleId,
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ var threw = true;
    /******/ try {
      /******/ __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
      /******/ threw = false;
      /******/
    } finally {
      /******/ if (threw) delete __webpack_module_cache__[moduleId];
      /******/
    }
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/trusted types policy */
  /******/ (() => {
    /******/ var policy;
    /******/ __webpack_require__.tt = () => {
      /******/ // Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
      /******/ if (policy === undefined) {
        /******/ policy = {
          /******/ createScript: (script) => script,
          /******/
        };
        /******/ if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
          /******/ policy = trustedTypes.createPolicy("nextjs#bundler", policy);
          /******/
        }
        /******/
      }
      /******/ return policy;
      /******/
    };
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/trusted types script */
  /******/ (() => {
    /******/ __webpack_require__.ts = (script) => __webpack_require__.tt().createScript(script);
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/react refresh */
  /******/ (() => {
    /******/ if (__webpack_require__.i) {
      /******/ __webpack_require__.i.push((options) => {
        /******/ const originalFactory = options.factory;
        /******/ options.factory = (moduleObject, moduleExports, webpackRequire) => {
          /******/ if (!originalFactory) {
            /******/ document.location.reload();
            /******/ return;
            /******/
          }
          /******/ const hasRefresh =
            typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
          /******/ const cleanup = hasRefresh
            ? self.$RefreshInterceptModuleExecution$(moduleObject.id)
            : () => {};
          /******/ try {
            /******/ originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
            /******/
          } finally {
            /******/ cleanup();
            /******/
          }
          /******/
        };
        /******/
      });
      /******/
    }
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/compat */
  /******/
  /******/
  /******/ // noop fns to prevent runtime errors during initialization
  /******/ if (typeof self !== "undefined") {
    /******/ self.$RefreshReg$ = function () {};
    /******/ self.$RefreshSig$ = function () {
      /******/ return function (type) {
        /******/ return type;
        /******/
      };
      /******/
    };
    /******/
  }
  /******/
  /************************************************************************/
  /******/
  /******/ // startup
  /******/ // Load entry module and return exports
  /******/ // This entry module can't be inlined because the eval-source-map devtool is used.
  /******/ var __webpack_exports__ = __webpack_require__("./worker/index.js");
  /******/
  /******/
})();
