const connectDb = require("../config/db");
const app = require("./index");

const PORT = 2222;

app.listen(PORT, async () => {
  await connectDb();
  console.log("port running on:", PORT);
});
