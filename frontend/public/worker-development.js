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
            '/* global self */ /** @param {Record<string, unknown>} data */ function safeString(v, fallback = "") {\n    return typeof v === "string" && v.trim() ? v.trim() : fallback;\n}\nself.addEventListener("push", (event)=>{\n    let data = {};\n    try {\n        data = event.data ? event.data.json() : {};\n    } catch  {\n    /* ignore */ }\n    const title = safeString(data.title, "PlanSync");\n    const body = safeString(data.body, "");\n    const rawUrl = data.url;\n    const url = typeof rawUrl === "string" && (rawUrl.startsWith("http") || rawUrl.startsWith("/")) ? rawUrl : `${self.location.origin}/`;\n    const tag = typeof data.tag === "string" && data.tag.length > 0 ? data.tag : undefined;\n    const ts = typeof data.timestamp === "number" && Number.isFinite(data.timestamp) ? data.timestamp : Date.now();\n    const options = {\n        body: body || "Open in PlanSync",\n        tag,\n        timestamp: ts,\n        data: {\n            url,\n            kind: typeof data.kind === "string" ? data.kind : ""\n        },\n        icon: `${self.location.origin}/icons/icon-512.png`,\n        badge: `${self.location.origin}/icons/icon-192.png`,\n        vibrate: [\n            180,\n            80,\n            180\n        ],\n        requireInteraction: false,\n        silent: false,\n        renotify: true,\n        dir: "auto"\n    };\n    event.waitUntil(self.registration.showNotification(title, options));\n});\nself.addEventListener("notificationclick", (event)=>{\n    event.notification.close();\n    const d = event.notification.data || {};\n    const raw = d.url;\n    let targetUrl = `${self.location.origin}/`;\n    if (typeof raw === "string" && raw.trim()) {\n        const t = raw.trim();\n        if (t.startsWith("http://") || t.startsWith("https://")) {\n            try {\n                const u = new URL(t);\n                if (u.origin === self.location.origin) targetUrl = u.href;\n            } catch  {\n            /* keep default */ }\n        } else if (t.startsWith("/") && !t.startsWith("//")) {\n            targetUrl = `${self.location.origin}${t}`;\n        }\n    }\n    event.waitUntil((async ()=>{\n        const clientsArr = await self.clients.matchAll({\n            type: "window",\n            includeUncontrolled: true\n        });\n        const targetOrigin = new URL(targetUrl).origin;\n        for (const client of clientsArr){\n            try {\n                if (new URL(client.url).origin !== targetOrigin) continue;\n                await client.focus();\n                if (typeof client.navigate === "function") {\n                    try {\n                        await client.navigate(targetUrl);\n                        return;\n                    } catch  {\n                    /* fall through */ }\n                }\n                return;\n            } catch  {\n                continue;\n            }\n        }\n        await self.clients.openWindow(targetUrl);\n    })());\n});\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we\'re in a\n        // browser context before continuing.\n        if (typeof self !== \'undefined\' &&\n            // No-JS mode does not inject these helpers:\n            \'$RefreshHelpers$\' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we\'ll check if it\'s\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                /* unsupported import.meta.webpackHot */ undefined.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we\'ll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it\'s possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFNLEdBQUcyQixHQUFHO1FBQzNDO0lBQ0Y7SUFFQXBDLE1BQU00QixTQUFTLENBQ2IsQ0FBQztRQUNDLE1BQU1ZLGFBQWEsTUFBTTFDLEtBQUsyQyxPQUFPLENBQUNDLFFBQVEsQ0FBQztZQUM3Q0MsTUFBTTtZQUNOQyxxQkFBcUI7UUFDdkI7UUFDQSxNQUFNQyxlQUFlLElBQUlQLElBQUlILFdBQVcxQixNQUFNO1FBQzlDLEtBQUssTUFBTXFDLFVBQVVOLFdBQVk7WUFDL0IsSUFBSTtnQkFDRixJQUFJLElBQUlGLElBQUlRLE9BQU94QyxHQUFHLEVBQUVHLE1BQU0sS0FBS29DLGNBQWM7Z0JBQ2pELE1BQU1DLE9BQU9DLEtBQUs7Z0JBQ2xCLElBQUksT0FBT0QsT0FBT0UsUUFBUSxLQUFLLFlBQVk7b0JBQ3pDLElBQUk7d0JBQ0YsTUFBTUYsT0FBT0UsUUFBUSxDQUFDYjt3QkFDdEI7b0JBQ0YsRUFBRSxPQUFNO29CQUNOLGdCQUFnQixHQUNsQjtnQkFDRjtnQkFDQTtZQUNGLEVBQUUsT0FBTTtnQkFDTjtZQUNGO1FBQ0Y7UUFDQSxNQUFNckMsS0FBSzJDLE9BQU8sQ0FBQ1EsVUFBVSxDQUFDZDtJQUNoQztBQUVKIiwic291cmNlcyI6WyIvVXNlcnMvYWJlZGFhcmFiaS9EZXNrdG9wL2NvZGUvcGxhbnN5bmMvZnJvbnRlbmQvd29ya2VyL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGdsb2JhbCBzZWxmICovXG5cbi8qKiBAcGFyYW0ge1JlY29yZDxzdHJpbmcsIHVua25vd24+fSBkYXRhICovXG5mdW5jdGlvbiBzYWZlU3RyaW5nKHYsIGZhbGxiYWNrID0gXCJcIikge1xuICByZXR1cm4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgJiYgdi50cmltKCkgPyB2LnRyaW0oKSA6IGZhbGxiYWNrO1xufVxuXG5zZWxmLmFkZEV2ZW50TGlzdGVuZXIoXCJwdXNoXCIsIChldmVudCkgPT4ge1xuICBsZXQgZGF0YSA9IHt9O1xuICB0cnkge1xuICAgIGRhdGEgPSBldmVudC5kYXRhID8gZXZlbnQuZGF0YS5qc29uKCkgOiB7fTtcbiAgfSBjYXRjaCB7XG4gICAgLyogaWdub3JlICovXG4gIH1cblxuICBjb25zdCB0aXRsZSA9IHNhZmVTdHJpbmcoZGF0YS50aXRsZSwgXCJQbGFuU3luY1wiKTtcbiAgY29uc3QgYm9keSA9IHNhZmVTdHJpbmcoZGF0YS5ib2R5LCBcIlwiKTtcbiAgY29uc3QgcmF3VXJsID0gZGF0YS51cmw7XG4gIGNvbnN0IHVybCA9XG4gICAgdHlwZW9mIHJhd1VybCA9PT0gXCJzdHJpbmdcIiAmJiAocmF3VXJsLnN0YXJ0c1dpdGgoXCJodHRwXCIpIHx8IHJhd1VybC5zdGFydHNXaXRoKFwiL1wiKSlcbiAgICAgID8gcmF3VXJsXG4gICAgICA6IGAke3NlbGYubG9jYXRpb24ub3JpZ2lufS9gO1xuXG4gIGNvbnN0IHRhZyA9IHR5cGVvZiBkYXRhLnRhZyA9PT0gXCJzdHJpbmdcIiAmJiBkYXRhLnRhZy5sZW5ndGggPiAwID8gZGF0YS50YWcgOiB1bmRlZmluZWQ7XG4gIGNvbnN0IHRzID1cbiAgICB0eXBlb2YgZGF0YS50aW1lc3RhbXAgPT09IFwibnVtYmVyXCIgJiYgTnVtYmVyLmlzRmluaXRlKGRhdGEudGltZXN0YW1wKVxuICAgICAgPyBkYXRhLnRpbWVzdGFtcFxuICAgICAgOiBEYXRlLm5vdygpO1xuXG4gIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgYm9keTogYm9keSB8fCBcIk9wZW4gaW4gUGxhblN5bmNcIixcbiAgICB0YWcsXG4gICAgdGltZXN0YW1wOiB0cyxcbiAgICBkYXRhOiB7IHVybCwga2luZDogdHlwZW9mIGRhdGEua2luZCA9PT0gXCJzdHJpbmdcIiA/IGRhdGEua2luZCA6IFwiXCIgfSxcbiAgICBpY29uOiBgJHtzZWxmLmxvY2F0aW9uLm9yaWdpbn0vaWNvbnMvaWNvbi01MTIucG5nYCxcbiAgICBiYWRnZTogYCR7c2VsZi5sb2NhdGlvbi5vcmlnaW59L2ljb25zL2ljb24tMTkyLnBuZ2AsXG4gICAgdmlicmF0ZTogWzE4MCwgODAsIDE4MF0sXG4gICAgcmVxdWlyZUludGVyYWN0aW9uOiBmYWxzZSxcbiAgICBzaWxlbnQ6IGZhbHNlLFxuICAgIHJlbm90aWZ5OiB0cnVlLFxuICAgIGRpcjogXCJhdXRvXCIsXG4gIH07XG5cbiAgZXZlbnQud2FpdFVudGlsKHNlbGYucmVnaXN0cmF0aW9uLnNob3dOb3RpZmljYXRpb24odGl0bGUsIG9wdGlvbnMpKTtcbn0pO1xuXG5zZWxmLmFkZEV2ZW50TGlzdGVuZXIoXCJub3RpZmljYXRpb25jbGlja1wiLCAoZXZlbnQpID0+IHtcbiAgZXZlbnQubm90aWZpY2F0aW9uLmNsb3NlKCk7XG4gIGNvbnN0IGQgPSBldmVudC5ub3RpZmljYXRpb24uZGF0YSB8fCB7fTtcbiAgY29uc3QgcmF3ID0gZC51cmw7XG4gIGxldCB0YXJnZXRVcmwgPSBgJHtzZWxmLmxvY2F0aW9uLm9yaWdpbn0vYDtcbiAgaWYgKHR5cGVvZiByYXcgPT09IFwic3RyaW5nXCIgJiYgcmF3LnRyaW0oKSkge1xuICAgIGNvbnN0IHQgPSByYXcudHJpbSgpO1xuICAgIGlmICh0LnN0YXJ0c1dpdGgoXCJodHRwOi8vXCIpIHx8IHQuc3RhcnRzV2l0aChcImh0dHBzOi8vXCIpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1ID0gbmV3IFVSTCh0KTtcbiAgICAgICAgaWYgKHUub3JpZ2luID09PSBzZWxmLmxvY2F0aW9uLm9yaWdpbikgdGFyZ2V0VXJsID0gdS5ocmVmO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGtlZXAgZGVmYXVsdCAqL1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodC5zdGFydHNXaXRoKFwiL1wiKSAmJiAhdC5zdGFydHNXaXRoKFwiLy9cIikpIHtcbiAgICAgIHRhcmdldFVybCA9IGAke3NlbGYubG9jYXRpb24ub3JpZ2lufSR7dH1gO1xuICAgIH1cbiAgfVxuXG4gIGV2ZW50LndhaXRVbnRpbChcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2xpZW50c0FyciA9IGF3YWl0IHNlbGYuY2xpZW50cy5tYXRjaEFsbCh7XG4gICAgICAgIHR5cGU6IFwid2luZG93XCIsXG4gICAgICAgIGluY2x1ZGVVbmNvbnRyb2xsZWQ6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHRhcmdldE9yaWdpbiA9IG5ldyBVUkwodGFyZ2V0VXJsKS5vcmlnaW47XG4gICAgICBmb3IgKGNvbnN0IGNsaWVudCBvZiBjbGllbnRzQXJyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKG5ldyBVUkwoY2xpZW50LnVybCkub3JpZ2luICE9PSB0YXJnZXRPcmlnaW4pIGNvbnRpbnVlO1xuICAgICAgICAgIGF3YWl0IGNsaWVudC5mb2N1cygpO1xuICAgICAgICAgIGlmICh0eXBlb2YgY2xpZW50Lm5hdmlnYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IGNsaWVudC5uYXZpZ2F0ZSh0YXJnZXRVcmwpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgLyogZmFsbCB0aHJvdWdoICovXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGF3YWl0IHNlbGYuY2xpZW50cy5vcGVuV2luZG93KHRhcmdldFVybCk7XG4gICAgfSkoKSxcbiAgKTtcbn0pO1xuIl0sIm5hbWVzIjpbInNhZmVTdHJpbmciLCJ2IiwiZmFsbGJhY2siLCJ0cmltIiwic2VsZiIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsImRhdGEiLCJqc29uIiwidGl0bGUiLCJib2R5IiwicmF3VXJsIiwidXJsIiwic3RhcnRzV2l0aCIsImxvY2F0aW9uIiwib3JpZ2luIiwidGFnIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwidHMiLCJ0aW1lc3RhbXAiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsIkRhdGUiLCJub3ciLCJvcHRpb25zIiwia2luZCIsImljb24iLCJiYWRnZSIsInZpYnJhdGUiLCJyZXF1aXJlSW50ZXJhY3Rpb24iLCJzaWxlbnQiLCJyZW5vdGlmeSIsImRpciIsIndhaXRVbnRpbCIsInJlZ2lzdHJhdGlvbiIsInNob3dOb3RpZmljYXRpb24iLCJub3RpZmljYXRpb24iLCJjbG9zZSIsImQiLCJyYXciLCJ0YXJnZXRVcmwiLCJ0IiwidSIsIlVSTCIsImhyZWYiLCJjbGllbnRzQXJyIiwiY2xpZW50cyIsIm1hdGNoQWxsIiwidHlwZSIsImluY2x1ZGVVbmNvbnRyb2xsZWQiLCJ0YXJnZXRPcmlnaW4iLCJjbGllbnQiLCJmb2N1cyIsIm5hdmlnYXRlIiwib3BlbldpbmRvdyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./worker/index.js\n',
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
