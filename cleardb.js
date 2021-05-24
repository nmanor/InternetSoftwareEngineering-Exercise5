const logandexit = require("./logandexit");
const mongo = require("mongoose");
//mongo.Promise = Promise;

(async () => {
  try {
      let db = await mongo.createConnection('mongodb://localhost/lab-sess-5778');
      await db.dropDatabase();
      logandexit('DB cleared');
  } catch (err) {
      logandexit("Failed: " + err);
  }
})();
