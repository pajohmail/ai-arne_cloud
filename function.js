// Entry point för Cloud Functions Gen 1
const handlers = require('./dist/index.js');
exports.managerHandler = handlers.managerHandler;
exports.apiNewsHandler = handlers.apiNewsHandler;
exports.generalNewsHandler = handlers.generalNewsHandler;