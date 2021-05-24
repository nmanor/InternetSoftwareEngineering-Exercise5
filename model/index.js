const debug = require("debug")("lab7:model");
const mongo = require("mongoose");

let db = mongo.createConnection();
(async () => {
    try {
        await db.openUri('mongodb://localhost/lab-sess-5778', {useNewUrlParser: true, useUnifiedTopology: true});
    } catch (err) {
        debug("Error connecting to DB: " + err);
    }
})();
debug('Pending DB connection');

require("./user")(db);

module.exports = model => db.model(model);
