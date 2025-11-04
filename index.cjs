// CommonJS entry point för Cloud Functions
const handlers = require('./dist/index.js');
exports.managerHandler = handlers.managerHandler;
exports.apiNewsHandler = handlers.apiNewsHandler;
exports.generalNewsHandler = handlers.generalNewsHandler;
