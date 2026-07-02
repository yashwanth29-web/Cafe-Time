const { AsyncLocalStorage } = require('async_hooks');

const branchContextStore = new AsyncLocalStorage();

module.exports = {
  branchContextStore,
  getContext: () => branchContextStore.getStore(),
  runWithContext: (context, fn) => branchContextStore.run(context, fn)
};
